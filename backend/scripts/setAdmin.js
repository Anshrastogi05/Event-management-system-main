import mongoose from "mongoose";
import User from "../src/models/User.js";
import { env } from "../src/config/env.js";

const email = env.adminEmail;
const password = env.adminPassword;

if (!email || !password) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set");
}
async function main() {
  await mongoose.connect(env.mongoUri);

  await User.updateMany(
    { role: "admin", email: { $ne: email } },
    { $set: { role: "customer" } },
  );

  const existing = await User.findOne({ email }).select("+password");
  if (existing) {
    existing.name = "Admin";
    existing.role = "admin";
    existing.password = password;
    existing.isBlocked = false;
    existing.isEmailVerified = true;
    await existing.save();
    console.log("Updated admin user:", existing.email);
  } else {
    const created = await User.create({
      name: "Admin",
      email,
      password,
      role: "admin",
      isEmailVerified: true,
    });
    console.log("Created admin user:", created.email);
  }

  const adminUsers = await User.find({ role: "admin" })
    .select("email role")
    .lean();
  console.log("Current admin users:", adminUsers);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

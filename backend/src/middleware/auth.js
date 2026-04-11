import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  try {
    const userId = decoded.id || decoded._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const user = await User.findById(userId)
      .select('name email role isBlocked')
      .lean();

    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (user.isBlocked) return res.status(403).json({ message: 'User is blocked' });

    req.user = {
      id: user._id.toString(),
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}


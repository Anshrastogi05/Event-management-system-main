export function expandSeatLayout(sections) {
  return sections.flatMap((section) =>
    section.rows.flatMap((rowLabel) =>
      Array.from({ length: section.seatsPerRow }, (_unused, index) => ({
        seatId: `${rowLabel}${index + 1}`,
        row: rowLabel,
        number: index + 1,
        section: section.name,
        price: section.price,
      }))
    )
  );
}

export function getPriceRange(seats = []) {
  if (!seats.length) return { min: 0, max: 0 };

  const prices = seats.map((seat) => seat.price);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

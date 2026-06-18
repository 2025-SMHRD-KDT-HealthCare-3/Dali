export default function StarBg({ bgClass, starClass, positions, children }) {
  return (
    <div className={bgClass} aria-hidden="true">
      {children}
      {positions.map(pos => (
        <span key={pos} className={`${starClass} ${pos}`}>✦</span>
      ))}
    </div>
  )
}

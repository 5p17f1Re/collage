const springRate = Math.PI * 2
const springEndValue = 1 - (1 + springRate) * Math.exp(-springRate)

export function criticallyDampedSpring(progress: number) {
  const time = Math.min(1, Math.max(0, progress))
  // Critically damped spring residual: (1 + ωt)e^-ωt, normalized to finish at 1.
  return (1 - (1 + springRate * time) * Math.exp(-springRate * time)) / springEndValue
}

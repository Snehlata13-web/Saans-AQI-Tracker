import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DPR } from '../lib/perf'
import { useTabVisible } from '../lib/useActive'

// Smog particles animated entirely on the GPU (no per-frame JS loops)
const vert = `
uniform float uTime; uniform float uDensity; uniform float uSize;
attribute float aSeed;
varying float vA;
void main() {
  vec3 p = position;
  float spd = 0.2 + fract(aSeed * 7.13) * 0.8;
  p.x = mod(p.x + 17.0 + uTime * 0.25 * spd, 34.0) - 17.0;
  p.y += sin(uTime * 0.3 + aSeed * 40.0) * 0.6;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float on = step(aSeed, uDensity);
  gl_PointSize = on * uSize * (6.0 / -mv.z);
  vA = on * (0.35 + fract(aSeed * 13.7) * 0.65);
}`
const frag = `
uniform vec3 uColor; varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vA * 0.55;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}`
const sparkFrag = `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(1.0, 0.78, 0.42, a);
}`

function Field({ n, size, color, density, spark }) {
  const ref = useRef()
  const { geo, uni } = useMemo(() => {
    const pos = new Float32Array(n * 3), seed = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 34
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20
      pos[i * 3 + 2] = (Math.random() - 0.5) * 14 - 2
      seed[i] = Math.random()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return { geo, uni: { uTime: { value: 0 }, uDensity: { value: density }, uSize: { value: size }, uColor: { value: new THREE.Color(color) } } }
  }, [n])
  const target = useMemo(() => new THREE.Color(), [])
  useFrame(({ clock, pointer }) => {
    uni.uTime.value = clock.elapsedTime
    uni.uDensity.value += (density - uni.uDensity.value) * 0.02
    uni.uColor.value.lerp(target.set(color), 0.02)
    ref.current.rotation.y += (pointer.x * 0.12 - ref.current.rotation.y) * 0.03
    ref.current.rotation.x += (-pointer.y * 0.08 - ref.current.rotation.x) * 0.03
  })
  return (
    <points ref={ref} geometry={geo}>
      <shaderMaterial vertexShader={vert} fragmentShader={spark ? sparkFrag : frag} uniforms={uni} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}

export default function Backdrop({ color = '#2ee59d', aqi = 50 }) {
  const density = Math.min(1, 0.18 + (aqi || 0) / 260)
  const visible = useTabVisible()
  return (
    <div className="backdrop">
      <Canvas camera={{ position: [0, 0, 9], fov: 60 }} dpr={Math.min(DPR, 1)} frameloop={visible ? 'always' : 'never'} gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}>
        <Field n={1800} size={7} color={color} density={density} />
        <Field n={70} size={14} color="#ffc66b" density={1} spark />
      </Canvas>
    </div>
  )
}

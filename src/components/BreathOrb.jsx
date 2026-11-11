import { useEffect, useMemo, useRef } from 'react'
import { LITE, DPR } from '../lib/perf'
import { useActive } from '../lib/useActive'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, MeshDistortMaterial, Sparkles, Html } from '@react-three/drei'
import * as THREE from 'three'

// A breathing "air sample" — particle density scales with live PM2.5. Motion runs in the vertex shader.
const pVert = `
uniform float uTime; uniform float uScale; attribute float aSeed;
void main() {
  vec3 p = position + vec3(sin(uTime * 0.6 + aSeed), cos(uTime * 0.5 + aSeed * 1.3), sin(uTime * 0.4 + aSeed * 0.7)) * 0.06;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = 0.035 * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`
const pFrag = `
uniform vec3 uColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(uColor, 0.95 * smoothstep(0.5, 0.15, d));
}`

function Particles({ count, color }) {
  const ref = useRef()
  const { geo, mat } = useMemo(() => {
    const pos = new Float32Array(count * 3), seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const r = 1.25 * Math.cbrt(Math.random())
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1)
      pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph)], i * 3)
      seed[i] = Math.random() * 100
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const mat = new THREE.ShaderMaterial({ vertexShader: pVert, fragmentShader: pFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uScale: { value: 300 }, uColor: { value: new THREE.Color(color) } } })
    return { geo, mat }
  }, [count])
  useEffect(() => { mat.uniforms.uColor.value.set(color) }, [color, mat])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  useFrame(({ clock, size, viewport }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uScale.value = (size.height / 2) * viewport.dpr
    ref.current.rotation.y = clock.elapsedTime * 0.08
  })
  return <points ref={ref} geometry={geo} material={mat} />
}

function Breather({ color, pm, inhale }) {
  const g = useRef()
  const k = useRef(1)
  useFrame(({ clock, pointer }) => {
    // 4s inhale / 4s exhale; holding "breathe" swells the orb; follows the cursor
    const base = 1 + Math.sin((clock.elapsedTime * Math.PI) / 4) * 0.07
    k.current += ((inhale ? 1.32 : 1) - k.current) * 0.04
    g.current.scale.setScalar(base * k.current)
    g.current.rotation.y += (pointer.x * 0.6 - g.current.rotation.y) * 0.05
    g.current.rotation.x += (-pointer.y * 0.4 - g.current.rotation.x) * 0.05
  })
  const count = Math.round(Math.min(LITE ? 900 : 2600, Math.max(40, (pm || 0) * (LITE ? 7 : 14))))
  return (
    <group ref={g}>
      <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.6}>
        <mesh>
          <sphereGeometry args={[1.45, LITE ? 32 : 64, LITE ? 32 : 64]} />
          <MeshDistortMaterial color={color} distort={0.18} speed={1.6} transparent opacity={0.13} roughness={0.1} metalness={0.2} emissive={color} emissiveIntensity={0.25} />
        </mesh>
        <mesh>
          <torusGeometry args={[1.75, 0.008, 16, 160]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2.3, 0.3, 0]}>
          <torusGeometry args={[1.95, 0.005, 16, 160]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.35} />
        </mesh>
        <Particles key={count} count={count} color={color} />
      </Float>
    </group>
  )
}

function Orbiters({ items }) {
  const g = useRef()
  useFrame(({ clock }) => { g.current.rotation.y = clock.elapsedTime * 0.18 })
  return (
    <group ref={g} rotation={[0.25, 0, 0.12]}>
      {items.map((it, i) => {
        const a = (i / items.length) * Math.PI * 2
        return (
          <group key={it.label} position={[Math.cos(a) * 2.15, Math.sin(a * 2) * 0.35, Math.sin(a) * 2.15]}>
            <mesh>
              <sphereGeometry args={[0.06, 16, 16]} />
              <meshBasicMaterial color={it.color} toneMapped={false} />
            </mesh>
            <Html center distanceFactor={6} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
              <div className="orbit-chip" style={{ '--c': it.color }}><b>{it.label}</b><span>{it.value}</span></div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

export default function BreathOrb({ color = '#2ee59d', pm = 10, height = 340, orbit, zoom = 5.2, inhale = false }) {
  const [ref, active] = useActive()
  return (
    <div ref={ref} className="orb-box" style={{ height, width: '100%' }}>
      <Canvas camera={{ position: [0, 0, zoom], fov: 45 }} dpr={DPR} frameloop={active ? 'always' : 'never'} gl={{ alpha: true, antialias: !LITE, powerPreference: 'high-performance', stencil: false }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[3, 3, 4]} intensity={40} color={color} />
        <pointLight position={[-4, -2, 2]} intensity={20} color="#ff9f1c" />
        <Breather color={color} pm={pm} inhale={inhale} />
        {orbit && <Orbiters items={orbit} />}
        {!LITE && <Sparkles count={40} scale={6} size={2} speed={0.3} color="#ffd27a" />}
      </Canvas>
    </div>
  )
}

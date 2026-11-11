import { useMemo, useRef, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Html } from '@react-three/drei'
import * as THREE from 'three'
import { category, hiThreshold, scaleName } from '../lib/aqi'
import { LITE, DPR } from '../lib/perf'
import { useActive } from '../lib/useActive'

const R = 2
export function latLonToVec(lat, lon, r = R) {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((lon + 180) * Math.PI) / 180
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta))
}

const atmoVert = `varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `
const atmoFrag = `uniform vec3 c; varying vec3 vN; void main(){ float i = pow(0.72 - dot(vN, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(c, 1.0) * i; }`

function Earth() {
  const [night, bump] = useLoader(THREE.TextureLoader, ['/earth-night.jpg', '/earth-topology.jpg'])
  night.colorSpace = THREE.SRGBColorSpace
  return (
    <group>
      <mesh>
        <sphereGeometry args={[R, LITE ? 48 : 96, LITE ? 48 : 96]} />
        <meshStandardMaterial map={night} bumpMap={bump} bumpScale={0.04} emissiveMap={night} emissive="#ffffff" emissiveIntensity={0.9} roughness={1} metalness={0} />
      </mesh>
      <mesh scale={1.18}>
        <sphereGeometry args={[R, 64, 64]} />
        <shaderMaterial vertexShader={atmoVert} fragmentShader={atmoFrag} uniforms={{ c: { value: new THREE.Color('#5ec8ff') } }} side={THREE.BackSide} blending={THREE.AdditiveBlending} transparent depthWrite={false} />
      </mesh>
    </group>
  )
}

function Pillar({ p, onSelect, selected }) {
  const ref = useRef()
  const ring = useRef()
  const [hover, setHover] = useState(false)
  const cat = category(p.us_aqi)
  const h = Math.max(0.04, Math.min(1.4, (p.us_aqi || 0) / (hiThreshold() * 1.45)))
  const { pos, quat, base } = useMemo(() => {
    const n = latLonToVec(p.lat, p.lon, 1).normalize()
    return {
      pos: n.clone().multiplyScalar(R + h / 2),
      base: n.clone().multiplyScalar(R + 0.005),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n),
    }
  }, [p.lat, p.lon, h])
  const hot = (p.us_aqi || 0) > hiThreshold()
  useFrame(({ clock }) => {
    if (ring.current) {
      const s = 1 + ((clock.elapsedTime * 0.8 + p.lat) % 1) * 2.2
      ring.current.scale.setScalar(s)
      ring.current.material.opacity = 0.9 * (1 - (s - 1) / 2.2)
    }
    if (ref.current) ref.current.material.emissiveIntensity = hover || selected ? 3 : 1.4
  })
  return (
    <group>
      <mesh ref={ref} position={pos} quaternion={quat}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = '' }}
        onClick={(e) => { e.stopPropagation(); onSelect?.(p) }}>
        <cylinderGeometry args={[0.011, 0.02, h, 10]} />
        <meshStandardMaterial color={cat.color} emissive={cat.color} emissiveIntensity={1.4} toneMapped={false} transparent opacity={0.92} />
      </mesh>
      {hot && (
        <mesh ref={ring} position={base} quaternion={quat}>
          <ringGeometry args={[0.03, 0.045, 32]} />
          <meshBasicMaterial color={cat.color} transparent side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
      {(hover || selected) && (
        <Html position={pos.clone().multiplyScalar(1 + h / 3)} center distanceFactor={7} zIndexRange={[20, 0]}>
          <div className="globe-tip" style={{ borderColor: cat.color }}>
            <b>{p.name}</b>
            <span style={{ color: cat.color }}>{scaleName()} {p.us_aqi ?? '—'}</span>
            <small>PM2.5 {p.pm2_5 ?? '—'} µg/m³</small>
          </div>
        </Html>
      )}
    </group>
  )
}

function CameraFocus({ target }) {
  const { camera } = useThree()
  const goal = useRef(null)
  useEffect(() => {
    if (target) goal.current = latLonToVec(target.lat, target.lon, 6.6)
  }, [target?.lat, target?.lon])
  useFrame(() => {
    if (!goal.current) return
    // move along the sphere (never through the Earth), easing direction and distance separately
    const len = camera.position.length()
    const dir = camera.position.clone().normalize().lerp(goal.current.clone().normalize(), 0.06).normalize()
    camera.position.copy(dir.multiplyScalar(len + (goal.current.length() - len) * 0.06))
    camera.lookAt(0, 0, 0)
    if (camera.position.distanceTo(goal.current) < 0.05) goal.current = null
  })
  return null
}

export default function Globe({ points = [], onSelect, selected, focus, height = 520, autoRotate = true }) {
  const [ref, active] = useActive()
  return (
    <div ref={ref} className="globe-wrap" style={{ height }}>
      <Canvas camera={{ position: [0, 1.5, 6.6], fov: 45 }} dpr={DPR} frameloop={active ? 'always' : 'never'} gl={{ antialias: !LITE, alpha: true, powerPreference: 'high-performance' }}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 3, 5]} intensity={1.6} color="#bfe3ff" />
        <pointLight position={[-6, -2, -4]} intensity={30} color="#ff7a18" />
        <Stars radius={60} depth={40} count={LITE ? 1200 : 4000} factor={3} fade speed={0.6} />
        <Suspense fallback={null}>
          <Earth />
          {points.filter((p) => p.us_aqi != null).map((p) => (
            <Pillar key={p.name + p.lat} p={p} onSelect={onSelect} selected={selected && selected.name === p.name} />
          ))}
        </Suspense>
        <CameraFocus target={selected || focus} />
        <OrbitControls enablePan={false} minDistance={2.8} maxDistance={10} autoRotate={autoRotate} autoRotateSpeed={0.45} enableDamping />
      </Canvas>
    </div>
  )
}

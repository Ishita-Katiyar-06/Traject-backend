import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { WORLD_POLYGONS } from './world_polygons';



export interface Hotspot {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  trend: string;
  category: string;
  velocity: string;
  volume: string;
  badgeBg: string;
  badgeText: string;
}

const HOTSPOTS: Hotspot[] = [
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    lat: 35.6762,
    lon: 139.6503,
    trend: 'Quantum Sensor Fabrication Bottleneck',
    category: 'Hardware Signal',
    velocity: '+225%',
    volume: '42.8K posts',
    badgeBg: 'bg-rose-500/10 border-rose-500/25',
    badgeText: 'text-rose-700',
  },
  {
    id: 'singapore',
    name: 'Singapore',
    country: 'Singapore',
    lat: 1.3521,
    lon: 103.8198,
    trend: 'Subsea Cable Routing Divergence',
    category: 'Connectivity',
    velocity: '+360%',
    volume: '28.4K posts',
    badgeBg: 'bg-sky-500/10 border-sky-500/25',
    badgeText: 'text-sky-700',
  },
  {
    id: 'london',
    name: 'London',
    country: 'United Kingdom',
    lat: 51.5074,
    lon: -0.1278,
    trend: 'Cross-Border Regulatory Arbitrage',
    category: 'Governance',
    velocity: '+190%',
    volume: '36.2K posts',
    badgeBg: 'bg-amber-500/10 border-amber-500/25',
    badgeText: 'text-amber-800',
  },
  {
    id: 'frankfurt',
    name: 'Frankfurt',
    country: 'Germany',
    lat: 50.1109,
    lon: 8.6821,
    trend: 'Wholesale Digital Settlement Standard',
    category: 'Fintech',
    velocity: '+215%',
    volume: '19.5K posts',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/25',
    badgeText: 'text-emerald-700',
  },
  {
    id: 'new_york',
    name: 'New York',
    country: 'United States',
    lat: 40.7128,
    lon: -74.0060,
    trend: 'Real-time AI Sentiment Divergence',
    category: 'Market Intelligence',
    velocity: '+240%',
    volume: '58.1K posts',
    badgeBg: 'bg-amber-500/10 border-amber-500/25',
    badgeText: 'text-amber-800',
  },
  {
    id: 'san_francisco',
    name: 'San Francisco',
    country: 'United States',
    lat: 37.7749,
    lon: -122.4194,
    trend: 'Frontier Autonomous Agents Influx',
    category: 'Deep Tech',
    velocity: '+380%',
    volume: '74.6K posts',
    badgeBg: 'bg-purple-500/10 border-purple-500/25',
    badgeText: 'text-purple-700',
  },
  {
    id: 'dubai',
    name: 'Dubai',
    country: 'United Arab Emirates',
    lat: 25.2048,
    lon: 55.2708,
    trend: 'Sovereign AI Compute Reserves',
    category: 'Infrastructure',
    velocity: '+440%',
    volume: '31.9K posts',
    badgeBg: 'bg-amber-500/10 border-amber-500/25',
    badgeText: 'text-amber-800',
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    country: 'India',
    lat: 19.0760,
    lon: 72.8777,
    trend: 'High-Volume UPI Settlement Spike',
    category: 'Fintech Velocity',
    velocity: '+410%',
    volume: '82.3K posts',
    badgeBg: 'bg-rose-500/10 border-rose-500/25',
    badgeText: 'text-rose-700',
  },
  {
    id: 'nairobi',
    name: 'Nairobi',
    country: 'Kenya',
    lat: -1.2921,
    lon: 36.8219,
    trend: 'Pan-African Micro-Remittance Spike',
    category: 'Emerging Markets',
    velocity: '+295%',
    volume: '16.7K posts',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/25',
    badgeText: 'text-emerald-700',
  },
  {
    id: 'sao_paulo',
    name: 'São Paulo',
    country: 'Brazil',
    lat: -23.5505,
    lon: -46.6333,
    trend: 'Agri-Satellite Yield Correlation',
    category: 'Commodities',
    velocity: '+195%',
    volume: '22.1K posts',
    badgeBg: 'bg-sky-500/10 border-sky-500/25',
    badgeText: 'text-sky-700',
  },
  {
    id: 'sydney',
    name: 'Sydney',
    country: 'Australia',
    lat: -33.8688,
    lon: 151.2093,
    trend: 'Critical Mineral Logistics Index Surge',
    category: 'Supply Chain',
    velocity: '+155%',
    volume: '14.3K posts',
    badgeBg: 'bg-amber-500/10 border-amber-500/25',
    badgeText: 'text-amber-800',
  },
  {
    id: 'cairo',
    name: 'Cairo',
    country: 'Egypt',
    lat: 30.0444,
    lon: 31.2357,
    trend: 'Red Sea Commercial Routing Shifts',
    category: 'Geopolitics',
    velocity: '+280%',
    volume: '29.0K posts',
    badgeBg: 'bg-rose-500/10 border-rose-500/25',
    badgeText: 'text-rose-700',
  },
  {
    id: 'seoul',
    name: 'Seoul',
    country: 'South Korea',
    lat: 37.5665,
    lon: 126.9780,
    trend: 'Neuromorphic HBM Silicon Spike',
    category: 'Semiconductors',
    velocity: '+330%',
    volume: '45.1K posts',
    badgeBg: 'bg-purple-500/10 border-purple-500/25',
    badgeText: 'text-purple-700',
  },
  {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    lat: 48.8566,
    lon: 2.3522,
    trend: 'Autonomous Aerial Defense Networks',
    category: 'Defense Tech',
    velocity: '+175%',
    volume: '21.4K posts',
    badgeBg: 'bg-sky-500/10 border-sky-500/25',
    badgeText: 'text-sky-700',
  },
  {
    id: 'lagos',
    name: 'Lagos',
    country: 'Nigeria',
    lat: 6.5244,
    lon: 3.3792,
    trend: 'Decentralized FX Inflow Rally',
    category: 'Crypto Flows',
    velocity: '+310%',
    volume: '27.5K posts',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/25',
    badgeText: 'text-emerald-700',
  },
  {
    id: 'toronto',
    name: 'Toronto',
    country: 'Canada',
    lat: 43.6532,
    lon: -79.3832,
    trend: 'Hydro-Powered Data Center Corridor',
    category: 'Infrastructure',
    velocity: '+145%',
    volume: '15.2K posts',
    badgeBg: 'bg-sky-500/10 border-sky-500/25',
    badgeText: 'text-sky-700',
  },
];

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

export type IntroPhase = 'space_spin' | 'points_pop' | 'trend_pop' | 'transitioning' | 'settled';

interface LandingGlobeProps {
  introPhase?: IntroPhase;
}

export const LandingGlobe: React.FC<LandingGlobeProps> = ({ introPhase = 'settled' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Slot 1 Popup
  const popup1Ref = useRef<HTMLDivElement>(null);
  const activeSpot1IdRef = useRef<string | null>(null);
  const [slot1Hotspot, setSlot1Hotspot] = React.useState<Hotspot | null>(null);
  const [slot1Visible, setSlot1Visible] = React.useState<boolean>(false);

  // Slot 2 Popup (Second non-overlapping popup)
  const popup2Ref = useRef<HTMLDivElement>(null);
  const activeSpot2IdRef = useRef<string | null>(null);
  const [slot2Hotspot, setSlot2Hotspot] = React.useState<Hotspot | null>(null);
  const [slot2Visible, setSlot2Visible] = React.useState<boolean>(false);

  const phaseRef = useRef<IntroPhase>(introPhase);
  useEffect(() => {
    phaseRef.current = introPhase;
  }, [introPhase]);

  const spinSpeedRef = useRef<number>(introPhase === 'settled' ? 0.003 : 0.155);
  const scaleProgRef = useRef<number>(introPhase === 'settled' ? 1 : 0.2);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let width = container.clientWidth || 500;
    let height = container.clientHeight || 500;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 2000);
    camera.position.set(0, 0, 480);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const GLOBE_RADIUS = 118;

    // 1. Offscreen Canvas for Earth Texture (Vibrant Realistic Ocean Blue + Solid Green Continents)
    const texCanvas = document.createElement('canvas');
    texCanvas.width = 2048;
    texCanvas.height = 1024;
    const ctx = texCanvas.getContext('2d');
    if (ctx) {
      // Vibrant, visibly pleasing realistic ocean blue gradient
      const oceanGrad = ctx.createRadialGradient(
        texCanvas.width * 0.52, texCanvas.height * 0.42, 60,
        texCanvas.width * 0.5, texCanvas.height * 0.5, texCanvas.width * 0.65
      );
      oceanGrad.addColorStop(0, '#38BDF8');     // Brilliant sunlit azure
      oceanGrad.addColorStop(0.22, '#0284C7');  // Bright radiant ocean blue
      oceanGrad.addColorStop(0.55, '#0369A1');  // Rich royal maritime blue
      oceanGrad.addColorStop(0.82, '#075985');  // Deep ocean blue
      oceanGrad.addColorStop(1, '#0C4A6E');     // Deep abyss horizon rim

      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, texCanvas.width, texCanvas.height);



      // Draw Continents: Vibrant Real Globe Green without country partitions
      const W = texCanvas.width;
      const H = texCanvas.height;

      ctx.fillStyle = '#22863A'; // Rich lush continental green
      ctx.strokeStyle = '#22863A';
      ctx.lineWidth = 1.4;

      WORLD_POLYGONS.forEach((ring) => {
        ctx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const x = ((ring[i][0] + 180) / 360) * W;
          const y = ((90 - ring[i][1]) / 180) * H;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
    }

    const globeTexture = new THREE.CanvasTexture(texCanvas);
    globeTexture.wrapS = THREE.RepeatWrapping;
    globeTexture.wrapT = THREE.ClampToEdgeWrapping;

    // Specular Map: Glossy Ocean (White) vs Matte Continents (Dark)
    const specCanvas = document.createElement('canvas');
    specCanvas.width = 1024;
    specCanvas.height = 512;
    const sCtx = specCanvas.getContext('2d');
    if (sCtx) {
      sCtx.fillStyle = '#ffffff'; // Ocean water has bright specular sheen
      sCtx.fillRect(0, 0, specCanvas.width, specCanvas.height);

      sCtx.fillStyle = '#1c1c1c'; // Continents have subtle diffuse reflection
      const sW = specCanvas.width;
      const sH = specCanvas.height;
      WORLD_POLYGONS.forEach((ring) => {
        sCtx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const x = ((ring[i][0] + 180) / 360) * sW;
          const y = ((90 - ring[i][1]) / 180) * sH;
          if (i === 0) sCtx.moveTo(x, y);
          else sCtx.lineTo(x, y);
        }
        sCtx.closePath();
        sCtx.fill();
      });
    }
    const specularMap = new THREE.CanvasTexture(specCanvas);
    specularMap.wrapS = THREE.RepeatWrapping;
    specularMap.wrapT = THREE.ClampToEdgeWrapping;

    // 2. Earth Sphere Mesh: Glossy Blue Ocean + Lush Green Continents
    const sphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const sphereMat = new THREE.MeshPhongMaterial({
      map: globeTexture,
      specularMap: specularMap,
      specular: 0x93c5fd,
      shininess: 34,
      emissive: 0x02172b,
      emissiveIntensity: 0.12,
    });
    const earthMesh = new THREE.Mesh(sphereGeo, sphereMat);
    globeGroup.add(earthMesh);

    // 3. Atmosphere Halo (Radiant Vibrant Earth Blue Rayleigh Glow)
    const atmosGeo = new THREE.SphereGeometry(GLOBE_RADIUS + 3.6, 64, 64);
    const atmosMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
          vec3 glowColor = vec3(0.28, 0.68, 1.0); // Vibrant Real Earth Blue
          gl_FragColor = vec4(glowColor, 1.0) * intensity * 0.98;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmosMesh);



    // 5. Global Hotspot Trend Points Across Continents
    const hotspotGroup = new THREE.Group();
    globeGroup.add(hotspotGroup);

    interface HotspotMarker {
      hotspot: Hotspot;
      dot: THREE.Mesh;
      ring: THREE.Mesh;
    }

    const hotspotMarkers: HotspotMarker[] = [];

    HOTSPOTS.forEach((spot) => {
      const pos = latLonToVector3(spot.lat, spot.lon, GLOBE_RADIUS + 0.6);

      // Core beacon dot
      const dotGeo = new THREE.SphereGeometry(2.0, 16, 16);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.copy(pos);
      hotspotGroup.add(dotMesh);

      // Pulsing cyan/blue halo ring on globe surface
      const ringGeo = new THREE.RingGeometry(2.2, 4.4, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(pos);
      ringMesh.lookAt(0, 0, 0);
      hotspotGroup.add(ringMesh);

      hotspotMarkers.push({
        hotspot: spot,
        dot: dotMesh,
        ring: ringMesh,
      });
    });

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.15);
    scene.add(ambientLight);

    const softDirLight = new THREE.DirectionalLight(0xffffff, 0.70);
    softDirLight.position.set(160, 200, 300);
    scene.add(softDirLight);

    // Initial Europe/Africa centering
    globeGroup.rotation.x = 0.22;
    globeGroup.rotation.y = -1.82;

    // Drag Interaction with Inertia Momentum
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };
    let velocity = { x: 0.0008, y: 0 };

    const canvasEl = renderer.domElement;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
      velocity = { x: 0, y: 0 };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMousePos.x;
      const deltaY = e.clientY - prevMousePos.y;

      globeGroup.rotation.y += deltaX * 0.005;
      globeGroup.rotation.x += deltaY * 0.005;
      globeGroup.rotation.x = Math.max(-0.85, Math.min(0.85, globeGroup.rotation.x));

      velocity = { x: deltaX * 0.0028, y: deltaY * 0.0028 };
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        velocity = { x: 0, y: 0 };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - prevMousePos.x;
      const deltaY = e.touches[0].clientY - prevMousePos.y;

      globeGroup.rotation.y += deltaX * 0.005;
      globeGroup.rotation.x += deltaY * 0.005;
      globeGroup.rotation.x = Math.max(-0.85, Math.min(0.85, globeGroup.rotation.x));

      velocity = { x: deltaX * 0.0028, y: deltaY * 0.0028 };
      prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    canvasEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvasEl.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);

    // Animation Loop with Center-Radius Hotspot Detection
    let animId: number;
    let clock = 0;
    const tempWorldPos = new THREE.Vector3();
    const introStartTime = performance.now();

    function animate() {
      animId = requestAnimationFrame(animate);
      clock += 0.03;

      // Dynamic resize check
      const curContainer = containerRef.current;
      const curW = curContainer?.clientWidth || 0;
      const curH = curContainer?.clientHeight || 0;
      if (curW > 0 && curH > 0 && (curW !== width || curH !== height)) {
        width = curW;
        height = curH;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }

      const currentPhase = phaseRef.current;
      const elapsed = (performance.now() - introStartTime) / 1000;

      // 1. Globe Pop-out Scale (fast spring pop from 0.2 to 1.0 in ~0.35s)
      if (scaleProgRef.current < 1.0) {
        scaleProgRef.current = Math.min(1, scaleProgRef.current + 0.045);
        const t = scaleProgRef.current;
        const ease = Math.sin(t * Math.PI * 0.5);
        const popScale = t >= 1 ? 1 : 0.2 + 0.8 * ease * (1 + 0.15 * Math.sin(t * Math.PI));
        globeGroup.scale.setScalar(popScale);
        atmosMesh.scale.setScalar(popScale);
      } else {
        globeGroup.scale.setScalar(1);
        atmosMesh.scale.setScalar(1);
      }

      // 2. Smooth Continuous Non-Zero Deceleration
      // Starts after a very minute delay (~0.26s) after points begin plotting
      if (elapsed >= 0.26) {
        // Continuous exponential deceleration toward resting rate: speed drops smoothly every frame
        // Acceleration is mathematically never 0 (no plateau or stuck sensation)
        spinSpeedRef.current = 0.0028 + (spinSpeedRef.current - 0.0028) * 0.974;
      }

      if (!isDragging) {
        globeGroup.rotation.y += spinSpeedRef.current;
        globeGroup.rotation.y += velocity.x;
        globeGroup.rotation.x += velocity.y;
        velocity.x *= 0.94;
        velocity.y *= 0.94;
      }

      // 3. Points Plotting: starts after very minute ms delay (~0.16s) while spinning rapidly
      const pointsStart = 0.16;
      if (elapsed < pointsStart && currentPhase !== 'settled') {
        hotspotMarkers.forEach(({ dot, ring }) => {
          dot.scale.setScalar(0);
          ring.scale.setScalar(0);
        });
      } else if (currentPhase !== 'settled') {
        const plotTime = elapsed - pointsStart;
        hotspotMarkers.forEach(({ dot, ring }, idx) => {
          const delay = idx * 0.046; // ~46ms stagger: all 16 plotted by t = 0.88s
          const pTime = Math.max(0, plotTime - delay);
          if (pTime <= 0) {
            dot.scale.setScalar(0);
            ring.scale.setScalar(0);
          } else {
            const p = Math.min(1, pTime / 0.18);
            const s = p >= 1 ? 1 : Math.sin(p * Math.PI * 0.5) * (1 + 0.45 * Math.sin(p * Math.PI));
            dot.scale.setScalar(s);
            ring.scale.setScalar(s * (1.0 + Math.sin(clock + idx * 0.4) * 0.22));
          }
        });
      } else {
        // Settled state: all dots visible with pulse
        hotspotMarkers.forEach(({ dot, ring }, idx) => {
          dot.scale.setScalar(1);
          const s = 1.0 + Math.sin(clock + idx * 0.4) * 0.22;
          ring.scale.set(s, s, s);
        });
      }

      // 4. Multiple Non-Overlapping Trend Dialogues (starts as soon as enough points are plotted: t >= 0.48s)
      const dialoguesStart = 0.48;
      if (elapsed < dialoguesStart && currentPhase !== 'settled') {
        if (activeSpot1IdRef.current !== null) {
          activeSpot1IdRef.current = null;
          setSlot1Visible(false);
        }
        if (activeSpot2IdRef.current !== null) {
          activeSpot2IdRef.current = null;
          setSlot2Visible(false);
        }
      } else {
        interface VisibleCandidate {
          hotspot: Hotspot;
          screenX: number;
          screenY: number;
          dist: number;
        }
        const visibleCandidates: VisibleCandidate[] = [];

        hotspotMarkers.forEach(({ hotspot, dot }) => {
          dot.getWorldPosition(tempWorldPos);
          // Must be on the forward visible hemisphere
          if (tempWorldPos.z > 35) {
            const proj = tempWorldPos.clone().project(camera);
            const screenX = ((proj.x + 1) / 2) * width;
            const screenY = ((-proj.y + 1) / 2) * height;
            const dist = Math.hypot(proj.x, proj.y);
            visibleCandidates.push({ hotspot, screenX, screenY, dist });
          }
        });

        // Sort candidates by proximity to center
        visibleCandidates.sort((a, b) => a.dist - b.dist);

        // Pick up to 2 distinct candidates that are separated by at least 160px so they NEVER overlap
        const chosen: VisibleCandidate[] = [];
        for (const cand of visibleCandidates) {
          const isFarEnough = chosen.every(
            (c) => Math.hypot(c.screenX - cand.screenX, c.screenY - cand.screenY) >= 160
          );
          if (isFarEnough) {
            chosen.push(cand);
            if (chosen.length >= 2) break;
          }
        }

        // Update Slot 1
        if (chosen.length >= 1) {
          const c1 = chosen[0];
          if (activeSpot1IdRef.current !== c1.hotspot.id) {
            activeSpot1IdRef.current = c1.hotspot.id;
            setSlot1Hotspot(c1.hotspot);
            setSlot1Visible(true);
          }
          if (popup1Ref.current) {
            popup1Ref.current.style.transform = `translate3d(${c1.screenX}px, ${c1.screenY}px, 0)`;
          }
        } else {
          if (activeSpot1IdRef.current !== null) {
            activeSpot1IdRef.current = null;
            setSlot1Visible(false);
          }
        }

        // Update Slot 2 (Second distinct, non-overlapping dialogue)
        if (chosen.length >= 2 && currentPhase !== 'settled') {
          const c2 = chosen[1];
          if (activeSpot2IdRef.current !== c2.hotspot.id) {
            activeSpot2IdRef.current = c2.hotspot.id;
            setSlot2Hotspot(c2.hotspot);
            setSlot2Visible(true);
          }
          if (popup2Ref.current) {
            popup2Ref.current.style.transform = `translate3d(${c2.screenX}px, ${c2.screenY}px, 0)`;
          }
        } else {
          if (activeSpot2IdRef.current !== null) {
            activeSpot2IdRef.current = null;
            setSlot2Visible(false);
          }
        }
      }

      atmosMesh.position.copy(globeGroup.position);
      renderer.render(scene, camera);
    }
    animate();

    const onResize = () => {
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      canvasEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvasEl.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', onResize);

      sphereGeo.dispose();
      sphereMat.dispose();
      globeTexture.dispose();
      atmosGeo.dispose();
      atmosMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full aspect-square flex items-center justify-center">
      {/* 3D WebGL Canvas Container */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      />

      {/* Dynamic Pop-up Trend Card 1 */}
      <div
        ref={popup1Ref}
        className="absolute top-0 left-0 pointer-events-none z-30"
        style={{
          opacity: slot1Visible ? 1 : 0,
          transition: 'opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform, opacity',
        }}
      >
        <div className="relative flex items-center justify-center">
          <div className="absolute w-8 h-8 rounded-full border-2 border-sky-400/90 animate-ping" />
          <div className="w-3.5 h-3.5 rounded-full bg-sky-400 shadow-[0_0_14px_#38bdf8] border-2 border-white z-10" />

          <div
            className={`absolute bottom-4 left-1/2 -translate-x-1/2 mb-2 pointer-events-auto transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              slot1Visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-2'
            }`}
          >
            <div className="relative bg-white/95 backdrop-blur-xl border border-white/90 shadow-[0_10px_24px_rgba(15,23,42,0.12),0_2px_6px_rgba(15,23,42,0.06)] rounded-xl px-4 py-2 select-none whitespace-nowrap text-center">
              <span className="font-brand text-[13.5px] font-bold text-[#111727] tracking-tight">
                {slot1Hotspot?.trend}
              </span>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white/95 rotate-45 border-r border-b border-white/90 shadow-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Pop-up Trend Card 2 (Second distinct, non-overlapping dialogue) */}
      <div
        ref={popup2Ref}
        className="absolute top-0 left-0 pointer-events-none z-30"
        style={{
          opacity: slot2Visible ? 1 : 0,
          transition: 'opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform, opacity',
        }}
      >
        <div className="relative flex items-center justify-center">
          <div className="absolute w-8 h-8 rounded-full border-2 border-sky-400/90 animate-ping" />
          <div className="w-3.5 h-3.5 rounded-full bg-sky-400 shadow-[0_0_14px_#38bdf8] border-2 border-white z-10" />

          <div
            className={`absolute bottom-4 left-1/2 -translate-x-1/2 mb-2 pointer-events-auto transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              slot2Visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-2'
            }`}
          >
            <div className="relative bg-white/95 backdrop-blur-xl border border-white/90 shadow-[0_10px_24px_rgba(15,23,42,0.12),0_2px_6px_rgba(15,23,42,0.06)] rounded-xl px-4 py-2 select-none whitespace-nowrap text-center">
              <span className="font-brand text-[13.5px] font-bold text-[#111727] tracking-tight">
                {slot2Hotspot?.trend}
              </span>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white/95 rotate-45 border-r border-b border-white/90 shadow-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

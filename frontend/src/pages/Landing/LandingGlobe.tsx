import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { WORLD_POLYGONS } from './world_polygons';

export type IntroPhase = 'space_spin' | 'points_pop' | 'trend_pop' | 'transitioning' | 'settled';

interface LandingGlobeProps {
  introPhase?: IntroPhase;
}

export interface IntelLocation {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  trend: string; // Real, concise 1-3 word topic detected at location
  indicatorColor: string;
}

// 8 Canonical Intelligence Hubs with concise, real location-specific trends
const INTEL_LOCATIONS: IntelLocation[] = [
  {
    id: 'new_york',
    name: 'New York',
    country: 'United States',
    countryCode: 'USA',
    lat: 40.7128,
    lon: -74.0060,
    trend: 'Fed Rate Cut',
    indicatorColor: '#f43f5e', // Rose
  },
  {
    id: 'london',
    name: 'London',
    country: 'United Kingdom',
    countryCode: 'GBR',
    lat: 51.5074,
    lon: -0.1278,
    trend: 'Election Debate',
    indicatorColor: '#38bdf8', // Sky Blue
  },
  {
    id: 'dubai',
    name: 'Dubai',
    country: 'United Arab Emirates',
    countryCode: 'ARE',
    lat: 25.2048,
    lon: 55.2708,
    trend: 'Oil Prices',
    indicatorColor: '#f59e0b', // Amber
  },
  {
    id: 'delhi',
    name: 'Delhi',
    country: 'India',
    countryCode: 'IND',
    lat: 28.6139,
    lon: 77.2090,
    trend: 'Monsoon Alerts',
    indicatorColor: '#2dd4bf', // Teal
  },
  {
    id: 'singapore',
    name: 'Singapore',
    country: 'Singapore',
    countryCode: 'SGP',
    lat: 1.3521,
    lon: 103.8198,
    trend: 'Crypto Markets',
    indicatorColor: '#34d399', // Emerald
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    countryCode: 'JPN',
    lat: 35.6762,
    lon: 139.6503,
    trend: 'AI Regulation',
    indicatorColor: '#a855f7', // Purple
  },
  {
    id: 'san_francisco',
    name: 'San Francisco',
    country: 'United States',
    countryCode: 'USA',
    lat: 37.7749,
    lon: -122.4194,
    trend: 'AI Startups',
    indicatorColor: '#fbbf24', // Warm Gold
  },
  {
    id: 'washington',
    name: 'Washington',
    country: 'United States',
    countryCode: 'USA',
    lat: 38.9072,
    lon: -77.0369,
    trend: 'Trade Policy',
    indicatorColor: '#60a5fa', // Blue
  },
];

// Strategic information flow arc pairs (Curved connection lines)
const SIGNAL_ARCS: [string, string][] = [
  ['new_york', 'london'],
  ['london', 'dubai'],
  ['dubai', 'delhi'],
  ['delhi', 'singapore'],
  ['singapore', 'tokyo'],
  ['tokyo', 'san_francisco'],
  ['washington', 'london'],
];

// Geographic Lat/Lon to 3D Cartesian coordinates
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// Generate smooth elevated great-circle arc points
function getGreatCircleArc(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  radius: number,
  maxAltitude: number,
  segments = 40
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const v1 = p1.clone().normalize();
  const v2 = p2.clone().normalize();
  const angle = v1.angleTo(v2);

  // Orthogonal basis vector in the plane of the two vectors
  const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
  const vOrth = new THREE.Vector3().crossVectors(normal, v1).normalize();

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const theta = t * angle;
    const surfaceDir = new THREE.Vector3()
      .copy(v1)
      .multiplyScalar(Math.cos(theta))
      .addScaledVector(vOrth, Math.sin(theta))
      .normalize();

    const alt = Math.sin(t * Math.PI) * maxAltitude;
    points.push(surfaceDir.multiplyScalar(radius + alt));
  }
  return points;
}

export const LandingGlobe: React.FC<LandingGlobeProps> = ({ introPhase = 'settled' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelCardRef = useRef<HTMLDivElement>(null);

  // Active highlighted location state
  const [activeCity, setActiveCity] = useState<IntelLocation | null>(INTEL_LOCATIONS[0]);
  const [isLabelVisible, setIsLabelVisible] = useState<boolean>(false);
  const [activeScreenPos, setActiveScreenPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // CSS Entrance state for initial blur & fade-in wrapper
  const [isSystemOnline, setIsSystemOnline] = useState<boolean>(false);

  // User interaction & affordance state
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);

  const phaseRef = useRef<IntroPhase>(introPhase);
  useEffect(() => {
    phaseRef.current = introPhase;
  }, [introPhase]);

  useEffect(() => {
    // Trigger CSS blur-to-clear entrance
    const timer = setTimeout(() => {
      setIsSystemOnline(true);
    }, 60);

    const container = containerRef.current;
    if (!container) return;

    let width = container.clientWidth || 500;
    let height = container.clientHeight || 500;

    // 1. Scene, Perspective Camera & Antialiased Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 2000);
    camera.position.set(0, 0, 480);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const GLOBE_RADIUS = 120;

    // 2. High-Precision Equirectangular Texture:
    // Dark translucent navy ocean + Muted emerald/slate landmass + Fine graticule grid
    const texCanvas = document.createElement('canvas');
    texCanvas.width = 2048;
    texCanvas.height = 1024;
    const ctx = texCanvas.getContext('2d');

    if (ctx) {
      const W = texCanvas.width;
      const H = texCanvas.height;

      // Base Deep Marine Teal-Blue Ocean with subtle latitudinal gradient
      const oceanGrad = ctx.createLinearGradient(0, 0, 0, H);
      oceanGrad.addColorStop(0, '#061424');     // Arctic polar deep
      oceanGrad.addColorStop(0.18, '#081d33');  // Sub-arctic marine
      oceanGrad.addColorStop(0.5, '#0c2946');   // Temperate/Equatorial rich marine teal
      oceanGrad.addColorStop(0.82, '#081d33');  // Southern ocean
      oceanGrad.addColorStop(1, '#061424');     // Antarctic abyss
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, W, H);

      // Subtle Longitude & Latitude Graticule Grid
      // Latitude Parallels
      for (let lat = -75; lat <= 75; lat += 15) {
        const y = ((90 - lat) / 180) * H;
        ctx.beginPath();
        if (lat === 0) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
          ctx.lineWidth = 1.0;
        } else if (Math.abs(lat) === 30 || Math.abs(lat) === 60) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
          ctx.lineWidth = 0.7;
        } else {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.04)';
          ctx.lineWidth = 0.5;
        }
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Longitude Meridians
      for (let lon = -180; lon <= 180; lon += 15) {
        const x = ((lon + 180) / 360) * W;
        ctx.beginPath();
        if (lon === 0) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
          ctx.lineWidth = 1.0;
        } else if (lon % 30 === 0) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
          ctx.lineWidth = 0.7;
        } else {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.04)';
          ctx.lineWidth = 0.5;
        }
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }

      // Coastal Continental Shelf Glow
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.15)';
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      WORLD_POLYGONS.forEach((ring) => {
        ctx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const x = ((ring[i][0] + 180) / 360) * W;
          const y = ((90 - ring[i][1]) / 180) * H;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      });

      // Secondary Delicate Shelf Rim
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.22)';
      ctx.lineWidth = 2.2;
      WORLD_POLYGONS.forEach((ring) => {
        ctx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const x = ((ring[i][0] + 180) / 360) * W;
          const y = ((90 - ring[i][1]) / 180) * H;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      });

      // Continents Fill: Refined Dark Emerald / Slate-Green
      ctx.fillStyle = '#17362d';
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
      });

      // Crisp Coastline Boundary
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.42)';
      ctx.lineWidth = 0.9;
      WORLD_POLYGONS.forEach((ring) => {
        ctx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const x = ((ring[i][0] + 180) / 360) * W;
          const y = ((90 - ring[i][1]) / 180) * H;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      });

      // Micro digital intelligence telemetry nodes
      ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
      const TELEMETRY_NODES = [
        [30, 20], [25, 45], [45, 30], [55, 25], [10, 50],
        [-95, 38], [-105, 42], [-80, 35], [-60, -15], [-50, -20],
        [100, 35], [115, 30], [80, 22], [135, -25]
      ];
      TELEMETRY_NODES.forEach(([lon, lat]) => {
        const x = ((lon + 180) / 360) * W;
        const y = ((90 - lat) / 180) * H;
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const globeTexture = new THREE.CanvasTexture(texCanvas);
    globeTexture.wrapS = THREE.RepeatWrapping;
    globeTexture.wrapT = THREE.ClampToEdgeWrapping;

    // Specular Map: Glossy Ocean vs Matte Continents
    const specCanvas = document.createElement('canvas');
    specCanvas.width = 1024;
    specCanvas.height = 512;
    const sCtx = specCanvas.getContext('2d');
    if (sCtx) {
      sCtx.fillStyle = '#bae6fd'; // Oceans reflect daylight glint
      sCtx.fillRect(0, 0, specCanvas.width, specCanvas.height);

      sCtx.fillStyle = '#080c10'; // Landmasses are matte diffuse
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
        ctx?.closePath();
        sCtx.fill();
      });
    }
    const specularMap = new THREE.CanvasTexture(specCanvas);
    specularMap.wrapS = THREE.RepeatWrapping;
    specularMap.wrapT = THREE.ClampToEdgeWrapping;

    // 3. Earth Sphere Mesh
    const sphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const sphereMat = new THREE.MeshPhongMaterial({
      map: globeTexture,
      specularMap: specularMap,
      specular: 0x38bdf8,
      shininess: 26,
      emissive: 0x031728,
      emissiveIntensity: 0.16,
      transparent: true,
      opacity: 0.2, // Will smoothly illuminate up during entrance
    });
    const earthMesh = new THREE.Mesh(sphereGeo, sphereMat);
    globeGroup.add(earthMesh);

    // 4. Subtle Atmospheric Rim Halo Shader
    const atmosGeo = new THREE.SphereGeometry(GLOBE_RADIUS + 3.2, 64, 64);
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
        uniform float uOpacity;
        void main() {
          // Soft radial falloff along perimeter
          float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.4);
          intensity = clamp(intensity, 0.0, 1.0);
          vec3 glowColor = vec3(0.18, 0.68, 0.94);
          gl_FragColor = vec4(glowColor, intensity * uOpacity);
        }
      `,
      uniforms: {
        uOpacity: { value: 0.0 }, // Illuminates smoothly during entrance
      },
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmosMesh);

    // 5. Signal Connection Arcs (Curved Information Flow Lines)
    const arcGroup = new THREE.Group();
    globeGroup.add(arcGroup);

    interface SignalArcData {
      fromId: string;
      toId: string;
      curve: THREE.CatmullRomCurve3;
      tubeMesh: THREE.Mesh;
      pulseMesh: THREE.Mesh;
      pulseProgress: number;
      pulseSpeed: number;
    }

    const arcDataList: SignalArcData[] = [];

    const locPosMap = new Map<string, THREE.Vector3>();
    INTEL_LOCATIONS.forEach((loc) => {
      locPosMap.set(loc.id, latLonToVector3(loc.lat, loc.lon, GLOBE_RADIUS));
    });

    SIGNAL_ARCS.forEach(([fromId, toId], i) => {
      const p1 = locPosMap.get(fromId);
      const p2 = locPosMap.get(toId);
      if (!p1 || !p2) return;

      const dist = p1.distanceTo(p2);
      const altitude = Math.min(Math.max(dist * 0.17, 10), 24);
      const arcPoints = getGreatCircleArc(p1, p2, GLOBE_RADIUS, altitude, 40);
      const curve = new THREE.CatmullRomCurve3(arcPoints);

      const tubeGeo = new THREE.TubeGeometry(curve, 36, 0.4, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.0, // Illuminates during entrance
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      arcGroup.add(tubeMesh);

      const packetGeo = new THREE.SphereGeometry(1.1, 12, 12);
      const packetMat = new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.0, // Illuminates during entrance
      });
      const packetMesh = new THREE.Mesh(packetGeo, packetMat);
      arcGroup.add(packetMesh);

      arcDataList.push({
        fromId,
        toId,
        curve,
        tubeMesh,
        pulseMesh: packetMesh,
        pulseProgress: (i * 0.16) % 1.0,
        pulseSpeed: 0.0035 + (i % 3) * 0.0008,
      });
    });

    // 6. Intelligent Location Markers (Pin, Halo, Generous Hit Area, and Dynamic Pulse)
    const markerGroup = new THREE.Group();
    globeGroup.add(markerGroup);

    interface MarkerObject {
      location: IntelLocation;
      pos: THREE.Vector3;
      coreDot: THREE.Mesh;
      hitMesh: THREE.Mesh;
      pulseRing: THREE.Mesh;
      pinStem: THREE.Line;
    }

    const markerObjects: MarkerObject[] = [];
    const hitMeshes: THREE.Mesh[] = [];

    INTEL_LOCATIONS.forEach((loc) => {
      const pos = latLonToVector3(loc.lat, loc.lon, GLOBE_RADIUS + 0.6);

      // Core luminous beacon dot
      const coreGeo = new THREE.SphereGeometry(1.9, 16, 16);
      const coreMat = new THREE.MeshBasicMaterial({
        color: loc.indicatorColor,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.copy(pos);
      coreMesh.scale.setScalar(0.001); // Scales in on entrance
      markerGroup.add(coreMesh);

      // Generous invisible hit testing sphere (radius 8) for easy clicking and hover
      const hitGeo = new THREE.SphereGeometry(8.0, 8, 8);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.copy(pos);
      hitMesh.userData = { locationId: loc.id };
      markerGroup.add(hitMesh);
      hitMeshes.push(hitMesh);

      // Concentric expanding ring on surface
      const ringGeo = new THREE.RingGeometry(2.4, 4.8, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.0,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(pos);
      ringMesh.lookAt(0, 0, 0);
      markerGroup.add(ringMesh);

      // Mini vertical beacon stem pointing outward
      const normal = pos.clone().normalize();
      const tipPos = pos.clone().addScaledVector(normal, 4.5);
      const stemGeo = new THREE.BufferGeometry().setFromPoints([pos, tipPos]);
      const stemMat = new THREE.LineBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.0,
      });
      const stemLine = new THREE.Line(stemGeo, stemMat);
      markerGroup.add(stemLine);

      markerObjects.push({
        location: loc,
        pos,
        coreDot: coreMesh,
        hitMesh,
        pulseRing: ringMesh,
        pinStem: stemLine,
      });
    });

    // 7. Lighting
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.95);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.25);
    sunLight.position.set(220, 240, 280);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x0ea5e9, 0.4);
    rimLight.position.set(-200, -100, -100);
    scene.add(rimLight);

    // Warm Amber key light to harmoniously tie into Traject's golden brand aura
    const warmAmberLight = new THREE.DirectionalLight(0xf59e0b, 0.42);
    warmAmberLight.position.set(-220, 200, 180);
    scene.add(warmAmberLight);

    // Initial Starting Angle: Natural view across Atlantic / Americas / Europe
    globeGroup.rotation.x = 0.20;
    globeGroup.rotation.y = -1.75;

    // Start with subtle smaller scale for initial entrance
    globeGroup.scale.setScalar(0.82);
    atmosMesh.scale.setScalar(0.82);

    // Interactive Drag & Raycasting with Smooth Momentum
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };
    let dragVelocity = { x: 0.0006, y: 0 };
    let dragDistance = 0;

    // Smooth camera ease when city pin is selected
    let isTargetingCity = false;
    let targetRotY = 0;
    let targetRotX = 0;

    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2();

    const canvasEl = renderer.domElement;
    canvasEl.style.touchAction = 'pan-y';

    const getNDCCoords = (clientX: number, clientY: number) => {
      const rect = canvasEl.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -((clientY - rect.top) / rect.height) * 2 + 1,
      };
    };

    let currentActiveId: string = INTEL_LOCATIONS[0].id;
    let activeSwitchTime = performance.now() + 3200; // Wait for fast spin to settle before first card
    const DISPLAY_DURATION_MS = 3600; // Duration each location card stays prominent
    const shownHistory: string[] = [currentActiveId];

    const selectCityById = (locId: string) => {
      const loc = INTEL_LOCATIONS.find((l) => l.id === locId);
      if (!loc) return;
      setHasInteracted(true);
      currentActiveId = loc.id;
      setActiveCity(loc);
      setIsLabelVisible(true);
      activeSwitchTime = performance.now() + 5500; // Hold for 5.5s on selected hub

      // Target angles to face front
      targetRotY = -Math.PI / 2 - (loc.lon * Math.PI) / 180;
      targetRotX = Math.max(-0.4, Math.min(0.4, (loc.lat * Math.PI) / 180 * 0.35));
      isTargetingCity = true;
    };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      dragDistance = 0;
      isTargetingCity = false;
      setHasInteracted(true);
      prevMousePos = { x: e.clientX, y: e.clientY };
      dragVelocity = { x: 0, y: 0 };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) {
        // Raycast hover check to change cursor to pointer
        const ndc = getNDCCoords(e.clientX, e.clientY);
        mouseNDC.set(ndc.x, ndc.y);
        raycaster.setFromCamera(mouseNDC, camera);
        const hits = raycaster.intersectObjects(hitMeshes);
        if (hits.length > 0) {
          canvasEl.style.cursor = 'pointer';
        } else {
          canvasEl.style.cursor = 'grab';
        }
        return;
      }

      canvasEl.style.cursor = 'grabbing';
      const deltaX = e.clientX - prevMousePos.x;
      const deltaY = e.clientY - prevMousePos.y;
      dragDistance += Math.hypot(deltaX, deltaY);

      globeGroup.rotation.y += deltaX * 0.0045;
      globeGroup.rotation.x += deltaY * 0.0045;
      globeGroup.rotation.x = Math.max(-0.75, Math.min(0.75, globeGroup.rotation.x));

      dragVelocity = { x: deltaX * 0.0022, y: deltaY * 0.0022 };
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onClick = (e: MouseEvent) => {
      if (dragDistance < 8) {
        const ndc = getNDCCoords(e.clientX, e.clientY);
        mouseNDC.set(ndc.x, ndc.y);
        raycaster.setFromCamera(mouseNDC, camera);
        const hits = raycaster.intersectObjects(hitMeshes);
        if (hits.length > 0) {
          const locId = hits[0].object.userData.locationId;
          if (locId) selectCityById(locId);
        }
      }
    };

    let touchStartPos = { x: 0, y: 0 };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        dragDistance = 0;
        isTargetingCity = false;
        setHasInteracted(true);
        prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        dragVelocity = { x: 0, y: 0 };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - prevMousePos.x;
      const deltaY = e.touches[0].clientY - prevMousePos.y;
      dragDistance += Math.hypot(deltaX, deltaY);

      globeGroup.rotation.y += deltaX * 0.0045;
      globeGroup.rotation.x += deltaY * 0.0045;
      globeGroup.rotation.x = Math.max(-0.75, Math.min(0.75, globeGroup.rotation.x));

      dragVelocity = { x: deltaX * 0.0022, y: deltaY * 0.0022 };
      prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onTouchEnd = () => {
      isDragging = false;
      if (dragDistance < 10) {
        const ndc = getNDCCoords(touchStartPos.x, touchStartPos.y);
        mouseNDC.set(ndc.x, ndc.y);
        raycaster.setFromCamera(mouseNDC, camera);
        const hits = raycaster.intersectObjects(hitMeshes);
        if (hits.length > 0) {
          const locId = hits[0].object.userData.locationId;
          if (locId) selectCityById(locId);
        }
      }
    };

    canvasEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvasEl.addEventListener('click', onClick);
    canvasEl.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    // 8. Animation Loop with Entrance System Online Choreography
    let animId: number;
    let clock = 0;
    const tempWorldPos = new THREE.Vector3();

    // Rotation speeds: fast spin on load, decelerates to steady cruise
    const BASE_ROTATION_SPEED = 0.0022;      // Steady cruise (~20s per full rotation)
    const FAST_SPIN_SPEED    = 0.020;        // Initial burst speed (~1.7s per full rotation)
    const FAST_SPIN_DURATION_MS = 3000;      // 3s deceleration ramp

    const mountTime = performance.now();
    const ENTRANCE_DURATION_MS = 1400; // 1.4s smooth cinematic power-up entrance

    function animate() {
      animId = requestAnimationFrame(animate);
      clock += 0.026;
      const now = performance.now();
      const elapsedSinceMount = now - mountTime;

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

      // Step 1 - Step 5: Initial Cinematic Entrance Interpolation
      const entranceProg = Math.min(1.0, elapsedSinceMount / ENTRANCE_DURATION_MS);
      // Smooth cubic ease-out curve
      const ease = 1 - Math.pow(1 - entranceProg, 3);

      if (entranceProg < 1.0) {
        // Scale from 0.82 to 1.0
        const currentScale = 0.82 + 0.18 * ease;
        globeGroup.scale.setScalar(currentScale);
        atmosMesh.scale.setScalar(currentScale);

        // Fade in Earth sphere
        sphereMat.opacity = 0.2 + 0.8 * ease;

        // Illuminate atmospheric rim
        atmosMat.uniforms.uOpacity.value = 0.72 * ease;

        // Illuminate orbital arcs
        arcDataList.forEach((arc) => {
          (arc.tubeMesh.material as THREE.MeshBasicMaterial).opacity = 0.24 * ease;
          (arc.pulseMesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * ease;
        });

        // Illuminate markers gradually
        markerObjects.forEach((m) => {
          m.coreDot.scale.setScalar(ease);
          (m.pinStem.material as THREE.LineBasicMaterial).opacity = 0.6 * ease;
        });

        // Progressive entrance rotation speed — during entrance still use fast-spin ramp
        if (!isDragging) {
          const spinProg = Math.min(1.0, elapsedSinceMount / FAST_SPIN_DURATION_MS);
          const spinEase = 1 - Math.pow(1 - spinProg, 2); // ease-out quad
          const currentSpeed = FAST_SPIN_SPEED - (FAST_SPIN_SPEED - BASE_ROTATION_SPEED) * spinEase;
          globeGroup.rotation.y += currentSpeed;
        }
      } else {
        // Entrance settled state
        globeGroup.scale.setScalar(1.0);
        atmosMesh.scale.setScalar(1.0);
        sphereMat.opacity = 1.0;
        atmosMat.uniforms.uOpacity.value = 0.72;

        // Continuous Rotation or Smooth Targeting of Clicked City
        if (isTargetingCity) {
          let dY = (targetRotY - globeGroup.rotation.y) % (Math.PI * 2);
          if (dY > Math.PI) dY -= Math.PI * 2;
          if (dY < -Math.PI) dY += Math.PI * 2;
          globeGroup.rotation.y += dY * 0.08;
          globeGroup.rotation.x += (targetRotX - globeGroup.rotation.x) * 0.08;
          if (Math.abs(dY) < 0.003 && Math.abs(targetRotX - globeGroup.rotation.x) < 0.003) {
            isTargetingCity = false;
          }
        } else if (!isDragging) {
          const spinProg = Math.min(1.0, elapsedSinceMount / FAST_SPIN_DURATION_MS);
          const spinEase = 1 - Math.pow(1 - spinProg, 2); // ease-out quad
          const currentSpeed = FAST_SPIN_SPEED - (FAST_SPIN_SPEED - BASE_ROTATION_SPEED) * spinEase;
          globeGroup.rotation.y += currentSpeed;
          globeGroup.rotation.y += dragVelocity.x;
          globeGroup.rotation.x += dragVelocity.y;
          dragVelocity.x *= 0.94;
          dragVelocity.y *= 0.94;
        }
      }

      // Animate Signal Arc Pulses with Connected Propagation Highlighting
      arcDataList.forEach((arc) => {
        const isConnected = arc.fromId === currentActiveId || arc.toId === currentActiveId;
        const speedMult = isConnected ? 2.2 : 1.0;
        arc.pulseProgress += arc.pulseSpeed * speedMult;
        if (arc.pulseProgress > 1.0) arc.pulseProgress = 0;
        const pt = arc.curve.getPointAt(arc.pulseProgress);
        arc.pulseMesh.position.copy(pt);

        if (entranceProg >= 1.0) {
          const targetTubeOpacity = isConnected ? 0.72 : 0.14;
          const targetPacketOpacity = isConnected ? 1.0 : 0.45;
          const tubeMat = arc.tubeMesh.material as THREE.MeshBasicMaterial;
          const packetMat = arc.pulseMesh.material as THREE.MeshBasicMaterial;

          tubeMat.opacity += (targetTubeOpacity - tubeMat.opacity) * 0.08;
          packetMat.opacity += (targetPacketOpacity - packetMat.opacity) * 0.08;
          tubeMat.color.setHex(isConnected ? 0x38bdf8 : 0x0284c7);
          packetMat.color.setHex(isConnected ? 0xfde047 : 0x7dd3fc);
        }
      });

      // Markers & Visibility Check (Disappear naturally when on back hemisphere)
      interface Candidate {
        marker: MarkerObject;
        screenX: number;
        screenY: number;
        facingScore: number;
      }

      const visibleCandidates: Candidate[] = [];

      // After fast-spin settles, allow card visibility
      const spinSettled = elapsedSinceMount > FAST_SPIN_DURATION_MS * 0.9;

      markerObjects.forEach((m) => {
        m.coreDot.getWorldPosition(tempWorldPos);

        // Only show on clearly front-facing hemisphere (z > 35 = ~75° from edge)
        if (tempWorldPos.z > 35 && entranceProg >= 0.7 && spinSettled) {
          const proj = tempWorldPos.clone().project(camera);
          const screenX = ((proj.x + 1) / 2) * width;
          const screenY = ((-proj.y + 1) / 2) * height;
          const facingScore = tempWorldPos.z / GLOBE_RADIUS;

          visibleCandidates.push({
            marker: m,
            screenX,
            screenY,
            facingScore,
          });

          // Soft pulse animation on surface ring
          const isCurrent = m.location.id === currentActiveId && isLabelVisible;
          const pulseSpeed = isCurrent ? 2.8 : 1.6;
          const pulseScale = isCurrent
            ? 1.0 + Math.sin(clock * pulseSpeed) * 0.45
            : 1.0 + Math.sin(clock * pulseSpeed) * 0.2;
          m.pulseRing.scale.set(pulseScale, pulseScale, pulseScale);
          (m.pulseRing.material as THREE.MeshBasicMaterial).opacity = isCurrent
            ? 0.85 + Math.sin(clock * pulseSpeed) * 0.15
            : 0.35;
          m.coreDot.scale.setScalar(isCurrent ? 1.4 : 1.0);
        } else {
          m.pulseRing.scale.set(1, 1, 1);
          (m.pulseRing.material as THREE.MeshBasicMaterial).opacity = 0.08;
          m.coreDot.scale.setScalar(0.75);
        }
      });

      // Dynamic Location Transition & Selection (Only after entrance AND fast-spin settled)
      if (entranceProg >= 1.0 && spinSettled) {
        visibleCandidates.sort((a, b) => b.facingScore - a.facingScore);

        const activeCandidate = visibleCandidates.find((c) => c.marker.location.id === currentActiveId);
        // Require city to be clearly facing viewer (score > 0.5 = within ~60° of center)
        const isCurrentFacingWell = activeCandidate && activeCandidate.facingScore > 0.5;
        const timeElapsed = now - activeSwitchTime;

        // Switch to next location when duration expires OR current active rotates out of clear view
        if (!isTargetingCity && (timeElapsed >= DISPLAY_DURATION_MS || !isCurrentFacingWell) && visibleCandidates.length > 0) {
          // Find best candidate not in recent history, clearly front-facing
          let next = visibleCandidates.find((c) => !shownHistory.includes(c.marker.location.id) && c.facingScore > 0.5);
          if (!next) {
            shownHistory.length = 0;
            next = visibleCandidates.find((c) => c.facingScore > 0.5) || visibleCandidates[0];
          }

          if (next && next.marker.location.id !== currentActiveId) {
            currentActiveId = next.marker.location.id;
            shownHistory.push(currentActiveId);
            if (shownHistory.length > 5) shownHistory.shift();

            // Hide card briefly for clean swap animation
            setIsLabelVisible(false);
            activeSwitchTime = now;
            setTimeout(() => {
              setActiveCity(next!.marker.location);
              setIsLabelVisible(true);
            }, 280);
          }
        }

        // Drag dampening: suppress card jitter during rapid mouse/touch drag
        const isRapidDrag = isDragging && Math.hypot(dragVelocity.x, dragVelocity.y) > 0.0035;

        // Update projected 2D coordinates for the active floating label card
        if (activeCandidate && activeCandidate.facingScore > 0.5 && !isRapidDrag) {
          setActiveScreenPos({ x: activeCandidate.screenX, y: activeCandidate.screenY });
          if (!isLabelVisible) {
            setIsLabelVisible(true);
          }
        } else {
          if (isLabelVisible) {
            setIsLabelVisible(false);
          }
        }
      }

      // Atmosphere tracks globe position
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
      clearTimeout(timer);
      cancelAnimationFrame(animId);
      canvasEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvasEl.removeEventListener('click', onClick);
      canvasEl.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', onResize);

      sphereGeo.dispose();
      sphereMat.dispose();
      globeTexture.dispose();
      specularMap.dispose();
      atmosGeo.dispose();
      atmosMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      className="relative w-full h-full aspect-square flex items-center justify-center select-none transition-all duration-1000 ease-out"
      style={{
        filter: isSystemOnline ? 'blur(0px)' : 'blur(6px)',
        opacity: isSystemOnline ? 1 : 0.35,
      }}
    >
      {/* Subtle Spherical Grounding Shadow */}
      <div className="absolute inset-4 rounded-full pointer-events-none bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.06)_0%,rgba(15,23,42,0.08)_50%,transparent_72%)] blur-2xl -z-10" />

      {/* 3D WebGL Canvas Viewport */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
        title="Click and drag to rotate the digital intelligence globe. Click any hub to inspect."
      />

      {/* Interactive Affordance Hint Pill */}
      <div
        className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 pointer-events-none transition-all duration-700 ease-out z-20 ${
          hasInteracted || !isSystemOnline ? 'opacity-0 translate-y-2 pointer-events-none' : 'opacity-100 translate-y-0'
        }`}
      >
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#081220]/85 border border-sky-400/25 backdrop-blur-md shadow-[0_4px_16px_rgba(2,8,20,0.6)]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <span className="text-[11px] font-mono text-sky-200/90 tracking-wide font-medium whitespace-nowrap">
            Drag to rotate • Click hub to explore
          </span>
        </div>
      </div>

      {/* Floating Precision Intelligence Trend Card (Answers: 'What are people talking about here right now?') */}
      <div
        ref={labelCardRef}
        className="absolute top-0 left-0 pointer-events-none z-30"
        style={{
          transform: `translate3d(${activeScreenPos.x}px, ${activeScreenPos.y}px, 0)`,
          willChange: 'transform, opacity',
        }}
      >
        <div
          className={`relative -translate-x-1/2 -translate-y-full mb-3.5 pointer-events-auto transition-all duration-[380ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isLabelVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-3'
          }`}
        >
          {/* Dark Navy Translucent Glass Card */}
          <div
            className="relative border border-sky-400/35 shadow-[0_12px_28px_rgba(2,8,20,0.6),0_0_16px_rgba(56,189,248,0.15)] rounded-lg px-3.5 py-2 min-w-[145px] max-w-[175px] select-none"
            style={{
              backgroundColor: 'rgba(8, 18, 32, 0.94)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            {/* Top row: City Name + Muted Country Code */}
            <div className="flex items-center justify-between gap-2.5 mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_6px_currentColor] animate-pulse"
                  style={{
                    backgroundColor: activeCity?.indicatorColor || '#38bdf8',
                    color: activeCity?.indicatorColor || '#38bdf8',
                  }}
                />
                <span className="font-semibold text-[13px] text-white tracking-tight truncate">
                  {activeCity?.name}
                </span>
              </div>
              <span className="text-[10px] font-mono font-medium text-sky-400/75 shrink-0 tracking-wider">
                {activeCity?.countryCode}
              </span>
            </div>

            {/* Bottom row: Real Concise Topic / Trend Name (The Visual Hero) */}
            <div className="flex items-center">
              <span className="text-[12.5px] font-medium text-sky-100 tracking-tight leading-tight">
                {activeCity?.trend}
              </span>
            </div>

            {/* Downward Anchor Stem to Point */}
            <div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b border-sky-400/35 shadow-sm"
              style={{ backgroundColor: 'rgba(8, 18, 32, 0.94)' }}
            />
          </div>

          {/* Very thin connection line extending down to the 3D pin */}
          <div className="w-[1px] h-3 bg-gradient-to-b from-sky-400/80 to-transparent mx-auto mt-0.5" />
        </div>
      </div>
    </div>
  );
};

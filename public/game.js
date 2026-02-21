import * as THREE from 'three';

// ============================================================
// Scene setup
// ============================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // sky blue
scene.fog = new THREE.Fog(0x87ceeb, 30, 60);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 6, 12);
camera.lookAt(0, 1.5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ============================================================
// Lighting
// ============================================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 30;
dirLight.shadow.camera.left = -10;
dirLight.shadow.camera.right = 10;
dirLight.shadow.camera.top = 10;
dirLight.shadow.camera.bottom = -10;
scene.add(dirLight);

// ============================================================
// Ground
// ============================================================
const groundGeo = new THREE.PlaneGeometry(40, 40);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x4caf50,
  roughness: 0.9,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Grid helper for visual reference
const grid = new THREE.GridHelper(40, 40, 0x388e3c, 0x388e3c);
grid.position.y = 0.01;
grid.material.opacity = 0.15;
grid.material.transparent = true;
scene.add(grid);

// ============================================================
// Stickman builder
// ============================================================
const STICK_COLOR = 0x222222;

function createLimb(radiusTop, radiusBottom, height) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 8);
  const mat = new THREE.MeshStandardMaterial({ color: STICK_COLOR });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

function createStickman() {
  const root = new THREE.Group();

  // Head
  const headGeo = new THREE.SphereGeometry(0.28, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({ color: STICK_COLOR });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 2.55;
  head.castShadow = true;
  root.add(head);

  // Eyes (white dots on face)
  const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.1, 2.6, 0.22);
  root.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.1, 2.6, 0.22);
  root.add(rightEye);

  // Pupils
  const pupilGeo = new THREE.SphereGeometry(0.025, 8, 8);
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
  leftPupil.position.set(-0.1, 2.6, 0.27);
  root.add(leftPupil);
  const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
  rightPupil.position.set(0.1, 2.6, 0.27);
  root.add(rightPupil);

  // Body (torso)
  const body = createLimb(0.06, 0.06, 1.0);
  body.position.y = 1.8;
  root.add(body);

  // --- Arms ---
  // Left upper arm pivot
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.06, 2.25, 0);
  root.add(leftArmPivot);
  const leftArm = createLimb(0.04, 0.04, 0.65);
  leftArm.position.y = -0.325;
  leftArmPivot.add(leftArm);

  // Right upper arm pivot
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.06, 2.25, 0);
  root.add(rightArmPivot);
  const rightArm = createLimb(0.04, 0.04, 0.65);
  rightArm.position.y = -0.325;
  rightArmPivot.add(rightArm);

  // --- Legs ---
  // Left leg pivot
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.1, 1.3, 0);
  root.add(leftLegPivot);
  const leftLeg = createLimb(0.05, 0.05, 0.8);
  leftLeg.position.y = -0.4;
  leftLegPivot.add(leftLeg);

  // Left lower leg pivot (knee)
  const leftKneePivot = new THREE.Group();
  leftKneePivot.position.set(0, -0.8, 0);
  leftLegPivot.add(leftKneePivot);
  const leftShin = createLimb(0.045, 0.045, 0.7);
  leftShin.position.y = -0.35;
  leftKneePivot.add(leftShin);

  // Right leg pivot
  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.1, 1.3, 0);
  root.add(rightLegPivot);
  const rightLeg = createLimb(0.05, 0.05, 0.8);
  rightLeg.position.y = -0.4;
  rightLegPivot.add(rightLeg);

  // Right lower leg pivot (knee)
  const rightKneePivot = new THREE.Group();
  rightKneePivot.position.set(0, -0.8, 0);
  rightLegPivot.add(rightKneePivot);
  const rightShin = createLimb(0.045, 0.045, 0.7);
  rightShin.position.y = -0.35;
  rightKneePivot.add(rightShin);

  root.userData = {
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    leftKneePivot,
    rightKneePivot,
  };

  return root;
}

const stickman = createStickman();
scene.add(stickman);

// ============================================================
// Walking animation
// ============================================================
let walkPhase = 0;
const WALK_SPEED = 8; // phase speed
const LEG_SWING = 0.6; // radians
const ARM_SWING = 0.5;
const KNEE_BEND = 0.5;

function animateWalk(dt, isMoving) {
  const { leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot, leftKneePivot, rightKneePivot } =
    stickman.userData;

  if (isMoving) {
    walkPhase += dt * WALK_SPEED;
  } else {
    // Return to idle smoothly
    walkPhase += dt * WALK_SPEED;
    // Dampen swing amplitudes toward 0
  }

  const swing = isMoving ? 1.0 : Math.max(0, 1.0 - walkPhase * 0.1);
  const s = Math.sin(walkPhase);

  leftLegPivot.rotation.x = s * LEG_SWING * (isMoving ? 1 : 0);
  rightLegPivot.rotation.x = -s * LEG_SWING * (isMoving ? 1 : 0);

  // Knee bends only when leg is going back
  leftKneePivot.rotation.x = isMoving ? Math.max(0, -s) * KNEE_BEND : 0;
  rightKneePivot.rotation.x = isMoving ? Math.max(0, s) * KNEE_BEND : 0;

  leftArmPivot.rotation.x = -s * ARM_SWING * (isMoving ? 1 : 0);
  rightArmPivot.rotation.x = s * ARM_SWING * (isMoving ? 1 : 0);
}

// ============================================================
// Touch / pointer input
// ============================================================
const pointer = {
  isDown: false,
  x: 0,
  y: 0,
};

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const targetPos = new THREE.Vector3();
let hasTarget = false;

function screenToWorld(clientX, clientY) {
  pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, hit);
  return hit;
}

function onPointerDown(e) {
  e.preventDefault();
  pointer.isDown = true;
  const touch = e.touches ? e.touches[0] : e;
  const worldPos = screenToWorld(touch.clientX, touch.clientY);
  if (worldPos) {
    targetPos.copy(worldPos);
    hasTarget = true;
  }
  // Hide hint after first touch
  const hint = document.getElementById('hint');
  if (hint) hint.style.display = 'none';
}

function onPointerMove(e) {
  e.preventDefault();
  if (!pointer.isDown) return;
  const touch = e.touches ? e.touches[0] : e;
  const worldPos = screenToWorld(touch.clientX, touch.clientY);
  if (worldPos) {
    targetPos.copy(worldPos);
    hasTarget = true;
  }
}

function onPointerUp(e) {
  e.preventDefault();
  pointer.isDown = false;
  hasTarget = false;
}

// Touch events
renderer.domElement.addEventListener('touchstart', onPointerDown, { passive: false });
renderer.domElement.addEventListener('touchmove', onPointerMove, { passive: false });
renderer.domElement.addEventListener('touchend', onPointerUp, { passive: false });
renderer.domElement.addEventListener('touchcancel', onPointerUp, { passive: false });

// Mouse events (for desktop testing)
renderer.domElement.addEventListener('mousedown', onPointerDown);
renderer.domElement.addEventListener('mousemove', onPointerMove);
renderer.domElement.addEventListener('mouseup', onPointerUp);
renderer.domElement.addEventListener('mouseleave', onPointerUp);

// ============================================================
// Movement
// ============================================================
const MOVE_SPEED = 5.0; // units per second
const ROTATION_SPEED = 10.0;
const STOP_DISTANCE = 0.2;
const BOUNDS = 18; // half-size of playable area

function moveStickman(dt) {
  if (!hasTarget) return false;

  const dx = targetPos.x - stickman.position.x;
  const dz = targetPos.z - stickman.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < STOP_DISTANCE) return false;

  // Rotate toward target
  const targetAngle = Math.atan2(dx, dz);
  let currentAngle = stickman.rotation.y;
  let angleDiff = targetAngle - currentAngle;

  // Normalize angle difference to [-PI, PI]
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  stickman.rotation.y += angleDiff * Math.min(1, ROTATION_SPEED * dt);

  // Move toward target
  const step = Math.min(dist, MOVE_SPEED * dt);
  stickman.position.x += (dx / dist) * step;
  stickman.position.z += (dz / dist) * step;

  // Clamp to bounds
  stickman.position.x = Math.max(-BOUNDS, Math.min(BOUNDS, stickman.position.x));
  stickman.position.z = Math.max(-BOUNDS, Math.min(BOUNDS, stickman.position.z));

  return true;
}

// ============================================================
// Camera follow
// ============================================================
const cameraOffset = new THREE.Vector3(0, 6, 12);
const cameraLookOffset = new THREE.Vector3(0, 1.5, 0);

function updateCamera(dt) {
  const desiredPos = stickman.position.clone().add(cameraOffset);
  camera.position.lerp(desiredPos, Math.min(1, 3 * dt));

  const lookTarget = stickman.position.clone().add(cameraLookOffset);
  camera.lookAt(lookTarget);
}

// ============================================================
// Decorations (some simple trees / rocks)
// ============================================================
function createTree(x, z) {
  const group = new THREE.Group();

  // Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.5, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.75;
  trunk.castShadow = true;
  group.add(trunk);

  // Foliage
  const foliageGeo = new THREE.SphereGeometry(0.8, 8, 8);
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32 });
  const foliage = new THREE.Mesh(foliageGeo, foliageMat);
  foliage.position.y = 2.0;
  foliage.castShadow = true;
  group.add(foliage);

  group.position.set(x, 0, z);
  return group;
}

function createRock(x, z, scale) {
  const geo = new THREE.DodecahedronGeometry(0.4 * scale, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.9 });
  const rock = new THREE.Mesh(geo, mat);
  rock.position.set(x, 0.2 * scale, z);
  rock.rotation.set(Math.random(), Math.random(), Math.random());
  rock.castShadow = true;
  return rock;
}

// Place some trees and rocks around the scene
const decorations = [
  createTree(-5, -4),
  createTree(6, -6),
  createTree(-8, 3),
  createTree(4, 7),
  createTree(-3, 9),
  createTree(9, -2),
  createTree(-7, -8),
  createRock(3, -3, 1),
  createRock(-4, 5, 1.5),
  createRock(7, 4, 0.8),
  createRock(-6, -6, 1.2),
  createRock(2, 8, 1),
];
decorations.forEach((d) => scene.add(d));

// ============================================================
// Animation loop
// ============================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05); // cap delta

  const isMoving = moveStickman(dt);
  animateWalk(dt, isMoving);
  updateCamera(dt);

  renderer.render(scene, camera);
}

animate();

// ============================================================
// Resize handler
// ============================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

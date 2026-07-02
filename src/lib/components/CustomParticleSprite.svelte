<script>
  import { T, useTask, useThrelte } from '@threlte/core';
  import { HTML } from '@threlte/extras';

  let { url, position, floatY = 0, scale, opacity } = $props();

  const { camera } = useThrelte();
  let distanceScale = $state(1.0);

  useTask(() => {
    if (!camera.current || !position) return;
    const camPos = camera.current.position;
    const dx = camPos.x - position[0];
    const dy = camPos.y - position[1];
    const dz = camPos.z - position[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const referenceDistance = 15;
    distanceScale = referenceDistance / Math.max(5, distance);
  });
</script>

{#if url}
  <T.Group position={position}>
    <HTML 
      sprite
      pointerEvents="none"
      center
    >
      <img 
        src={url} 
        alt="Particle Effect" 
        style="
          width: 100px;
          height: 100px;
          object-fit: contain;
          transform: scale({scale * distanceScale}) translateY(${-floatY * 100}px);
          opacity: {opacity};
          pointer-events: none;
        "
      />
    </HTML>
  </T.Group>
{/if}

<script>
  import { T } from '@threlte/core';
  import { LumaSplatsThree } from '@lumaai/luma-web';

  // The URL to the .spz Gaussian Splat file
  export let url = '/models/oscar_niemayer.spz';
  
  // Transformations to align the Splat with the VTT Grid
  export let position = [0, 0, 0];
  export let scale = [1, 1, 1];
  export let rotation = [0, 0, 0];
  
  // Initialize the Luma WebGL Splat viewer
  const splatMesh = new LumaSplatsThree({
    source: url,
    enableThreeJsIntegration: true,
  });
</script>

<!-- Add the splat mesh directly into the Threlte graph -->
<T is={splatMesh} {position} {scale} {rotation} />

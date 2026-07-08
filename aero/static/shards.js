/**
 * Lightweight animated glass shard background for AeRo.
 * It uses only simple DOM + CSS transforms so it stays smooth and cheap.
 */

(() => {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height, dpr;
  const shards = [];
  const count = 55;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function createShard() {
    return {
      x: rand(0, width),
      y: rand(0, height),
      w: rand(18, 64),
      h: rand(8, 28),
      speed: rand(0.08, 0.25),
      drift: rand(-0.12, 0.12),
      rotation: rand(0, Math.PI * 2),
      rotSpeed: rand(-0.008, 0.008),
      opacity: rand(0.06, 0.22),
      hue: rand(160, 340),
    };
  }

  function init() {
    resize();
    shards.length = 0;
    for (let i = 0; i < count; i++) {
      shards.push(createShard());
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    for (const s of shards) {
      s.y += s.speed;
      s.x += s.drift;
      s.rotation += s.rotSpeed;

      if (s.y > height + 40) {
        s.y = -50;
        s.x = rand(0, width);
      }
      if (s.x < -80) s.x = width + 60;
      if (s.x > width + 80) s.x = -60;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.globalAlpha = s.opacity;
      ctx.fillStyle = `hsla(${s.hue}, 70%, 60%, 0.85)`;
      ctx.beginPath();
      ctx.moveTo(-s.w / 2, -s.h / 2);
      ctx.lineTo(s.w / 2, -s.h / 4);
      ctx.lineTo(s.w / 3, s.h / 2);
      ctx.lineTo(-s.w / 2.5, s.h / 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  let frame = 0;
  function loop() {
    frame++;
    if (frame % 2 === 0) draw();
    requestAnimationFrame(loop);
  }

  init();
  loop();
  window.addEventListener('resize', init);
})();

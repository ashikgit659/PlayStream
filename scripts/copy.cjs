let cpy;
(async () => {
  cpy = await import('cpy');
  await cpy.default(['.next/static'], '.next/standalone/.next', { parents: true, cwd: process.cwd() });
  await cpy.default(['public'], '.next/standalone', { parents: true, cwd: process.cwd() });
})();

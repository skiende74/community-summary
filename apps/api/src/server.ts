import app from './app.js';

await app.listen({ host: '127.0.0.1', port: Number(process.env.PORT || 4318) });
console.log('댓글 요약 API: http://127.0.0.1:4318');

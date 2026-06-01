
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

function normalizeRut(rut){ return String(rut || '').replace(/[\.\s]/g,'').toLowerCase(); }
function hashPw(password, salt){
  const digest = crypto.pbkdf2Sync(String(password), String(salt), 120000, 32, 'sha256').toString('hex');
  return `${salt}$${digest}`;
}
function verifyPw(password, stored){
  try { const [salt, oldHash] = String(stored || '').split('$'); return hashPw(password, salt).split('$')[1] === oldHash; }
  catch(e){ return false; }
}
function newHash(password){ return hashPw(password, crypto.randomBytes(16).toString('hex')); }
function response(statusCode, body){ return {statusCode, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}, body: JSON.stringify(body)}; }
function publicUser(u){ return {id:u.id, rut:u.rut, nombre:u.nombre, cargo:u.cargo, perfil:u.perfil, debe_cambiar_clave: !!u.debe_cambiar_clave}; }
function localUsers(){
  const p = path.join(process.cwd(), 'data', 'usuarios_web.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch(e){ return []; }
}
function githubRequest(method, apiPath, body){
  const token = process.env.GITHUB_TOKEN;
  if(!token) return Promise.reject(new Error('Falta configurar GITHUB_TOKEN en Netlify'));
  const payload = body ? JSON.stringify(body) : null;
  const opts = {hostname:'api.github.com', path:apiPath, method, headers:{'User-Agent':'Sistema-Victoria-Netlify','Accept':'application/vnd.github+json','Authorization':`Bearer ${token}`}};
  if(payload){ opts.headers['Content-Type']='application/json'; opts.headers['Content-Length']=Buffer.byteLength(payload); }
  return new Promise((resolve,reject)=>{
    const req=https.request(opts,res=>{let data=''; res.on('data',d=>data+=d); res.on('end',()=>{let parsed={}; try{parsed=JSON.parse(data||'{}')}catch(e){}; if(res.statusCode>=200&&res.statusCode<300) resolve(parsed); else reject(new Error(parsed.message || `GitHub ${res.statusCode}`));});});
    req.on('error',reject); if(payload) req.write(payload); req.end();
  });
}
async function githubUsers(){
  const repo = process.env.GITHUB_REPO; // ejemplo: lucasborlando/Sistema-victoria-netlify
  const branch = process.env.GITHUB_BRANCH || 'principal';
  const filePath = process.env.USERS_FILE_PATH || 'Sistema_Victoria_NETLIFY_Informativo/data/usuarios_web.json';
  if(!repo || !process.env.GITHUB_TOKEN) return {users: localUsers(), sha:null, repo, branch, filePath, remote:false};
  const data = await githubRequest('GET', `/repos/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g,'/')}?ref=${encodeURIComponent(branch)}`);
  const txt = Buffer.from(data.content || '', 'base64').toString('utf8');
  return {users: JSON.parse(txt || '[]'), sha:data.sha, repo, branch, filePath, remote:true};
}
async function saveGithubUsers(ctx, users, message){
  if(!ctx.remote) throw new Error('Para cambiar contraseña debes configurar GITHUB_TOKEN, GITHUB_REPO y GITHUB_BRANCH en Netlify.');
  const content = Buffer.from(JSON.stringify(users, null, 2), 'utf8').toString('base64');
  return githubRequest('PUT', `/repos/${ctx.repo}/contents/${encodeURIComponent(ctx.filePath).replace(/%2F/g,'/')}`, {message, content, sha:ctx.sha, branch:ctx.branch});
}
module.exports = {normalizeRut, verifyPw, newHash, response, publicUser, githubUsers, saveGithubUsers};

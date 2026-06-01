
const {normalizeRut, verifyPw, newHash, response, publicUser, githubUsers, saveGithubUsers} = require('./_common');
exports.handler = async (event) => {
  if(event.httpMethod !== 'POST') return response(405, {ok:false, error:'Método no permitido'});
  try{
    const {rut, actual, nueva} = JSON.parse(event.body || '{}');
    if(!nueva || String(nueva).length < 8) return response(400, {ok:false, error:'La nueva contraseña debe tener mínimo 8 caracteres'});
    if(String(nueva) === '12345') return response(400, {ok:false, error:'No uses la clave por defecto 12345'});
    const id = normalizeRut(rut);
    const ctx = await githubUsers();
    const idx = ctx.users.findIndex(u => u.activo !== false && (normalizeRut(u.id) === id || normalizeRut(u.rut) === id));
    if(idx < 0 || !verifyPw(actual, ctx.users[idx].clave_hash)) return response(401, {ok:false, error:'Clave actual incorrecta'});
    ctx.users[idx].clave_hash = newHash(nueva);
    ctx.users[idx].debe_cambiar_clave = false;
    ctx.users[idx].actualizado_web = new Date().toISOString();
    await saveGithubUsers(ctx, ctx.users, `Cambio de contraseña web ${ctx.users[idx].rut || ctx.users[idx].id}`);
    return response(200, {ok:true, user:publicUser(ctx.users[idx])});
  }catch(e){ return response(500, {ok:false, error:e.message || 'No se pudo cambiar la contraseña'}); }
};

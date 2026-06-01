
const {normalizeRut, verifyPw, response, publicUser, githubUsers} = require('./_common');
exports.handler = async (event) => {
  if(event.httpMethod !== 'POST') return response(405, {ok:false, error:'Método no permitido'});
  try{
    const {rut, clave} = JSON.parse(event.body || '{}');
    const id = normalizeRut(rut);
    const ctx = await githubUsers();
    const user = ctx.users.find(u => u.activo !== false && (normalizeRut(u.id) === id || normalizeRut(u.rut) === id));
    if(!user || !verifyPw(clave, user.clave_hash)) return response(401, {ok:false, error:'RUT o clave incorrectos'});
    if(!['informativo','supervigilante'].includes(String(user.perfil || '').toLowerCase())) return response(403, {ok:false, error:'Este usuario no tiene permiso para la versión web informativa'});
    return response(200, {ok:true, user:publicUser(user)});
  }catch(e){ return response(500, {ok:false, error:e.message || 'Error de login'}); }
};

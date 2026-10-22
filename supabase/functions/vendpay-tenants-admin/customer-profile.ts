export function customerProfile(input: any) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const {display_name, extension, address = '', phone = ''} = input;
  if ([display_name, extension, address, phone].some(v => typeof v !== 'string')) return null;
  const profile = {display_name: display_name.trim(), extension: extension.trim(), address: address.trim(), phone: phone.trim()};
  if (!profile.display_name || profile.display_name.length > 120 || !/^[0-9]{1,8}$/.test(profile.extension) || profile.address.length > 300 || profile.phone.length > 32 || /[\u0000-\u001f\u007f]/.test(profile.display_name + profile.address + profile.phone) || (profile.phone && (!/^[+0-9 ()-]+$/.test(profile.phone) || !/[0-9]/.test(profile.phone)))) return null;
  return profile;
}

// Invoked only after the existing administrator authentication succeeds.
export async function updateCustomer(req: Request, admin: any, reply: any) {
  let input: any;
  try { input = await req.json(); } catch { return reply({error: 'Invalid JSON'}, 400); }
  const profile = customerProfile(input);
  if (!profile || typeof input.tenant_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.tenant_id) || !Number.isSafeInteger(input.profile_revision) || input.profile_revision < 0 || input.profile_revision >= 2147483647) return reply({error: 'Invalid customer details'}, 400);
  const {data, error} = await admin.from('vendpay_tenants').update({...profile, profile_revision: input.profile_revision + 1, updated_at: new Date().toISOString()}).eq('id', input.tenant_id).eq('profile_revision', input.profile_revision).select('id,display_name,extension,address,phone,profile_revision').maybeSingle();
  if (error) return reply({error: error.code === '23505' ? 'Extension already exists' : 'Unable to update customer'}, error.code === '23505' ? 409 : 500);
  if (!data) return reply({error: 'Customer details changed; reload before editing'}, 409);
  await admin.from('vendpay_tenant_audit').insert({tenant_id: data.id, action: 'update_profile', result: 'saved'});
  return reply({tenant: data, saved: true});
}

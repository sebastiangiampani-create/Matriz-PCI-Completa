-- Reversión de 01: restaura el valor exacto resguardado.
begin;
update public.pci_system_settings s
   set setting_value = r.setting_value, updated_at = now()
  from pci_resguardo_seguridad_20261126.pci_system_settings r
 where s.setting_key = r.setting_key and r.setting_key = 'institutional_master_code';
commit;
-- Luego: supabase functions deploy pci-master (desde la carpeta descargada antes de borrarla).

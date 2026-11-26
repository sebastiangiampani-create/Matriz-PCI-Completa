begin;
grant all on public.pci_proposals to anon, authenticated;
create policy "Lectura pública solo escuelas muestra" on public.pci_proposals
  for select to anon using ((school_id >= 1) and (school_id <= 4));
create policy "Actualización pública solo escuelas muestra" on public.pci_proposals
  for update to anon using ((school_id >= 1) and (school_id <= 4))
  with check ((school_id >= 1) and (school_id <= 4));
commit;

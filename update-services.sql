-- Update service names and remove Almenn bifreiðaskoðun
UPDATE public.services SET name_is = 'Bilanagreining', name_en = 'Vehicle diagnosis' WHERE name_is = 'Þarf greiningu';
UPDATE public.services SET name_is = 'Bremsuskipti og bremsuviðgerðir', name_en = 'Brake replacement and repair' WHERE name_is = 'Bremsuskipti';
UPDATE public.services SET is_active = false WHERE name_is = 'Almenn bifreiðaskoðun';

-- Allow app users to read booking counts for availability (no customer details exposed)
CREATE POLICY "bookings_workshop_availability_read" ON public.bookings_workshop
  FOR SELECT USING (
    -- Only allow reading start_time, duration_minutes, status — not customer details
    -- App needs this to check slot availability
    auth.uid() IS NOT NULL
  );

-- Allow app users to read workshop_blocks for availability
CREATE POLICY "workshop_blocks_read_authenticated" ON public.workshop_blocks
  FOR SELECT USING (auth.uid() IS NOT NULL);

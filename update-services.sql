-- Update service names and remove Almenn bifreiðaskoðun
UPDATE public.services SET name_is = 'Bilanagreining', name_en = 'Vehicle diagnosis' WHERE name_is = 'Þarf greiningu';
UPDATE public.services SET name_is = 'Bremsuskipti og bremsuviðgerðir', name_en = 'Brake replacement and repair' WHERE name_is = 'Bremsuskipti';
UPDATE public.services SET is_active = false WHERE name_is = 'Almenn bifreiðaskoðun';

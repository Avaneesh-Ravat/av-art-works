-- Rename legacy column if upgrading from an older 0003 migration.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'site_profile'
          AND column_name = 'artist_image_s3_key'
    ) THEN
        ALTER TABLE site_profile RENAME COLUMN artist_image_s3_key TO about_image_s3_key;
    END IF;
END $$;

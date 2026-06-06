SELECT count(*) AS total,
       count(*) FILTER (WHERE storage_key IS NOT NULL AND storage_key != '') AS with_audio
FROM recording_objects;

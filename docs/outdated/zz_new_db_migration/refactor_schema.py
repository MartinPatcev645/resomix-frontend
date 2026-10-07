import re
import sys

def main():
    filepath = '/Users/muhammadusmannaeem/Data/projects/Upwork/George/basic_fastapi_server_resomix/new_database.sql'
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Tables that keep BIGINT UNSIGNED
    keep_bigint = [
        'system_logs',
        'consumption_events',
        'ingestion_errors',
        'acr_infringement_logs',
        'user_sessions',
        'user_tokens',
        'ingest_log'
    ]

    # Replace primary keys inside CREATE TABLE
    # We will look for CREATE TABLE <name> ... id BIGINT UNSIGNED ...
    def pk_replacer(match):
        table_name = match.group(1).strip(' `')
        block = match.group(0)
        if table_name not in keep_bigint:
            # Replace 'id BIGINT UNSIGNED' with 'id INT UNSIGNED' or similar patterns
            block = re.sub(r'\bid\s+BIGINT\s+UNSIGNED', 'id INT UNSIGNED', block, count=1, flags=re.IGNORECASE)
        return block

    content = re.sub(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s*\([^;]+;', pk_replacer, content, flags=re.IGNORECASE)

    # Replace foreign keys globally
    fks_to_downsize = [
        'user_id', 'track_id', 'cart_id', 'order_id', 'promo_code_id', 
        'playlist_id', 'audio_file_id', 'image_file_id', 'document_file_id', 
        'contributor_id', 'deal_id', 'sftp_user_id', 'created_by'
    ]

    for fk in fks_to_downsize:
        # Replace occurrences like 'user_id BIGINT UNSIGNED'
        pattern = r'\b(' + fk + r')\s+BIGINT\s+UNSIGNED'
        content = re.sub(pattern, r'\1 INT UNSIGNED', content, flags=re.IGNORECASE)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print("Schema refactored successfully.")

if __name__ == '__main__':
    main()

import pymysql

# ==========================================
# DATABASE CONFIGURATION
# ==========================================
DB_HOST = "localhost"
DB_USER = "resomix_user"
DB_PASS = "resomix_prod"
DB_NAME = "resomix_prod"

TRACKS = [
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/BASIC/LOSSLESS/2024/07-2024/05/SW. - myDEFINITION II on Kalahari Oyster Cult/05-SW.-nightTRAIN29X_(www.electrobuzz.pro).flac",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/BASIC/Electrobuzz_Music/2025/02-2025/07/Yotam Avni - 2020-2025 Singles Collection/10-Yotam Avni-Acid Arab Breaks (Original Mix)_(AVNIart).mp3",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/POPULAR/Shops_Section/2024/10-2024/16-Exclusive/Breaks/Pat Lok, We Are Neurotic - Keep on Dancing  (Pat Lok Remix) [C3DO Recordings].wav",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/BASIC/Electrobuzz_Music/2021/12-2021/16/Job De Jong - Job de Jong Remixes (Airtime Records)/02-Job De Jong - Initiate (Tommy Vercetti Remix)-electrobuzz.net.mp3",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/POPULAR/Shops_Section/2024/10-2024/27-Exclusive/Breaks/June Chikuma - Marble Bitness (Original Mix) [Star Creature Universal Vibrations].mp3",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/BASIC/Electrobuzz_Music/2021/03-2021/12/Hugo Massien, Zun - Metamorphosis (E-Beamz)/05-Hugo Massien - Skin on Skin-electrobuzz.net.mp3",
    "veggera/public_html/feelmusic_premium/PHONOTRAX/BASIC/Essential_House/2015/02-2015/15/VA - Fused Funk Vol. 06-(FFVOL 06)/05-Fonzie-The Longest Time-Essentialhouse.net.mp3",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/BASIC/LOSSLESS/2023/09-2023/26/When the Lights Go (Deluxe) by Totally Enormous Extinct Dinosaurs on Nice Age.FLAC/05-Totally Enormous Extinct Dinosaurs-Be with You (Holiday87 Remix)_(www.electrobuzz.pro).flac",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/BASIC/Electrobuzz_Music/2021/12-2021/12/Confidential Recipe, Manao - The Bridge EP (Rekids)/04-Manao, Confidential Recipe - Come (Breaks Mix)-electrobuzz.net.mp3",
    "veggera/public_html/electrobuzz_music/Electrobuzz_FTP/ULTIMATE/BASIC/Electrobuzz_Music/2021/11-2021/23/Papa Nugs - Milk & Beans EP (No Dice)/00-Papa Nugs - Defuser-electrobuzz.net.mp3",
]

def main():
    connection = None
    try:
        connection = pymysql.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASS,
            database=DB_NAME,
            cursorclass=pymysql.cursors.DictCursor
        )
        
        query = """
        SELECT 
            t.id, 
            t.title, 
            t.duration_sec, 
            t.bpm, 
            t.year,
            g.name AS genre,
            l.name AS label,
            GROUP_CONCAT(a.name SEPARATOR ', ') AS artists
        FROM tracks t
        LEFT JOIN genres g ON t.genre_id = g.id
        LEFT JOIN labels l ON t.label_id = l.id
        LEFT JOIN track_artists ta ON t.id = ta.track_id
        LEFT JOIN artists a ON ta.artist_id = a.id
        WHERE t.file_path = %s
        GROUP BY t.id
        """
        
        print(f"Fetching metadata for {len(TRACKS)} tracks...\n")
        
        with connection.cursor() as cursor:
            for path in TRACKS:
                cursor.execute(query, (path,))
                result = cursor.fetchone()
                
                print("-" * 80)
                print(f"File Path : {path}")
                if result:
                    print(f"Title     : {result.get('title')}")
                    print(f"Artists   : {result.get('artists')}")
                    print(f"Duration  : {result.get('duration_sec')} sec")
                    print(f"BPM       : {result.get('bpm')}")
                    print(f"Year      : {result.get('year')}")
                    print(f"Genre     : {result.get('genre')}")
                    print(f"Label     : {result.get('label')}")
                else:
                    print("Status    : NOT FOUND IN DB")
                
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if connection and connection.open:
            connection.close()
            print("-" * 80 + "\n")
            print("Database connection closed.")

if __name__ == "__main__":
    main()

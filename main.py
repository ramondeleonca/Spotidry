import toml
import os
import sys
import webview
from webview import FileDialog
import spotipy
import base64
import argparse
import platformdirs
import re
from spotipy.oauth2 import SpotifyClientCredentials

# Load arguments
argparser = argparse.ArgumentParser(
    prog="Spotidry",
    epilog="Freeze dry your Spotify library 🥶",
    description="Spotify music downloader"
)

argparser.add_argument("--dev", action="store_true", help="Run in development mode")
argparser.add_argument("--port", type=int, default="5678", help="Port for development server (requires --dev)")
argparser.add_argument("--debug", action="store_true", help="Enable debug mode (shows webview inspector)")

args = argparser.parse_args()

# Constants
FROZEN = getattr(sys, 'frozen', False)
DIRNAME = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))

id_regex = r"(.+\/)|(\?.*)|(playlist|track|album)"
id_regex_flags = re.IGNORECASE | re.MULTILINE

type_regex = r"(playlist|track|album)"
type_regex_flags = re.IGNORECASE | re.MULTILINE

# App and path configs
APP_NAME = "Spotidry"
APP_DATA_DIR = platformdirs.user_data_dir(APP_NAME)
if not os.path.exists(APP_DATA_DIR):
    os.makedirs(APP_DATA_DIR)

# Set output dir (Create if missing)
OUT_DIR = os.path.join(platformdirs.user_music_dir(), APP_NAME)
if not os.path.exists(OUT_DIR):
    os.makedirs(OUT_DIR)

# Load credentials
with open(os.path.join(DIRNAME, 'creds.toml'), 'r') as f:
    print("Loaded credentials")
    creds = toml.load(f)

# Create Spotipy client
sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials(
    client_id=base64.b64decode(creds.get("client_id")).decode('utf-8'),
    client_secret=base64.b64decode(creds.get("client_secret")).decode('utf-8'),
    cache_handler=spotipy.MemoryCacheHandler() # We want this so it doesnt leave behind a .cache file with the token IN PLAIN SIGHT
))

# Create an API for the window to communicate with python
class API:
    # TODO: Check if this works if no folder was selected (exit)
    def chooseFolder(self, *args):
        global OUT_DIR
        OUT_DIR = window.create_file_dialog(dialog_type=FileDialog.FOLDER, directory=OUT_DIR, allow_multiple=False)[0]
        return OUT_DIR
    
    def getSelectedFolder(self, *args):
        return OUT_DIR
    
    def getFromLink(self, *args):
        link = args[0]
        print(link)
        
        # Extract ID and type from the link
        id_match: str = re.sub(id_regex, "", link, flags=id_regex_flags)
        type_match = re.search(type_regex, link, flags=type_regex_flags).group(0)

        print(type_match, id_match)

        if not id_match or not type_match:
            return None

        # Fetch data from Spotify
        if type_match == 'track':
            return sp.track(id_match)
        elif type_match == 'album':
            return sp.album(id_match)
        elif type_match == 'playlist':
            return sp.playlist(id_match)
        
        return None

    def close(self, *args):
        window.destroy()

# Create webview window
window_top_bar_height = 32
window_size = (400, 650 + window_top_bar_height)
window = webview.create_window(
    title="Spotidry",
    url=f"http://localhost:{args.port}" if args.dev else os.path.join(DIRNAME, 'frontend', 'dist', 'index.html'),
    width=window_size[0],
    height=window_size[1],
    resizable=False,
    fullscreen=False,
    min_size=window_size,
    confirm_close=True,
    js_api=API(),
    background_color="#121212",
    frameless=True,
    easy_drag=False
)

# Program entry function
def main():
    webview.start(debug=args.dev or args.debug, http_server=True)

if __name__ == "__main__":
    main()
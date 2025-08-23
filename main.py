import pytube.parser
import spotdl.download
import toml
import os
import sys
import webview
from webview import FileDialog
import base64
import argparse
import platformdirs
import re
import spotipy
import pytube
import threading
import json
import asyncio
import spotdl
import gettext
import concurrent.futures
import multiprocessing as mp
from spotdl.types.song import Song
from spotdl.types.album import Album
from spotdl.types.playlist import Playlist
from typing import Callable
from spotipy.oauth2 import SpotifyClientCredentials

# Disable translations for now
def null_translation(*args, **kwargs):
    return gettext.NullTranslations()

gettext.translation = null_translation
gettext.install = lambda *args, **kwargs: None

os.environ['LANGUAGE'] = 'C'
os.environ['LC_ALL'] = 'C'
os.environ['LANG'] = 'C'

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
CACHE_DIR = platformdirs.user_cache_dir(APP_NAME)

# Set output dir (Create if missing)
OUT_DIR_BASE = os.path.join(platformdirs.user_music_dir(), APP_NAME)
if not os.path.exists(OUT_DIR_BASE):
    os.makedirs(OUT_DIR_BASE)

# Load credentials
with open(os.path.join(DIRNAME, 'creds.toml'), 'r') as f:
    creds = toml.load(f)

# Create Spotipy client
CLIENT_ID = base64.b64decode(creds.get("client_id")).decode('utf-8')
CLIENT_SECRET = base64.b64decode(creds.get("client_secret")).decode('utf-8')
sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials(
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    cache_handler=spotipy.MemoryCacheHandler() # We want this so it doesnt leave behind a .cache file with the token IN PLAIN SIGHT
))

def get_from_link(link: str):
    # Extract ID and type from the link
    id_match: str = re.sub(id_regex, "", link, flags=id_regex_flags)
    type_match = re.search(type_regex, link, flags=type_regex_flags)

    if not id_match or not type_match:
        return None
    
    type_match = type_match.group(0).lower()

    # Fetch data from Spotify
    if type_match == 'track':
        result = sp.track(id_match)
    elif type_match == 'album':
        result = sp.album(id_match)
    elif type_match == 'playlist':
        result = sp.playlist(id_match)
    
    return result

track_search_thread: threading.Thread = None
track_search_results = {}
def search_tracks_in_background(spotify_result, on_result: Callable):
    global track_search_thread, track_search_results

    is_album = spotify_result["type"] == "album"

    def search():
        tracks = spotify_result["tracks"]["items"]
        for trackItem in tracks:
            track = trackItem["track"] if not is_album else trackItem

            if track is None:
                continue
            
            videos: list[pytube.YouTube]
            videos, continuation = pytube.Search(track["name"]).fetch_and_parse()

            if videos is None:
                continue
            
            track_search_results[track["id"]] = videos[0].vid_info

            on_result(track_search_results)

    if track_search_thread and track_search_thread.is_alive():
        track_search_thread.join()

    track_search_results = {}
    track_search_thread = threading.Thread(target=search)
    track_search_thread.start()

def update_track_results(results):
    window.evaluate_js(f"console.log(`{json.dumps(results)}`)")

def download_content(link, type_match, out_dir=None):
    """Thread-based solution that avoids pickling issues"""
    
    def _download():
        dl = spotdl.Spotdl(
            client_id=CLIENT_ID,
            client_secret=CLIENT_SECRET
        )
        
        if out_dir:
            dl.downloader.settings["output"] = out_dir
        
        try:
            if type_match == 'track':
                song = Song.from_url(link)
                results = [dl.download(song)]
                return results
                
            elif type_match == 'album':
                album = Album.from_url(link)
                results = dl.download_songs(album.songs)
                
            elif type_match == 'playlist':
                playlist = Playlist.from_url(link)
                results = dl.download_songs(playlist.songs)
                return results
                
        except Exception as e:
            print(f"Download error: {e}")
            return None
    
    # Use ThreadPoolExecutor instead of multiprocessing
    with concurrent.futures.ThreadPoolExecutor() as executor:
        future = executor.submit(_download)
        return future.result()

# Create an API for the window to communicate with python
window: webview.Window
class API:
    def chooseFolder(self, *args):
        global OUT_DIR_BASE
        paths = window.create_file_dialog(dialog_type=FileDialog.FOLDER, directory=OUT_DIR_BASE, allow_multiple=False)
        if paths:
            OUT_DIR_BASE = paths[0]
        return OUT_DIR_BASE
    
    def getSelectedFolder(self, *args):
        return OUT_DIR_BASE
    
    def getFromLink(self, *args):
        link = args[0]
        result = get_from_link(link)
        # search_tracks_in_background(result, update_track_results)
        return result

    def close(self, *args):
        window.destroy()

    def freezeDry(self, *args):
        link = args[0]

        out_dir = OUT_DIR_BASE
        os.makedirs(out_dir, exist_ok=True)

        type_match = re.search(type_regex, link, flags=type_regex_flags)
        if not type_match:
            return None
        type_match = type_match.group(0).lower()

        return download_content(link, type_match, out_dir)
            

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
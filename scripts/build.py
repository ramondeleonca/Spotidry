import os
import subprocess as sp
import sys
from PyInstaller import __main__ as pyinstaller

def get_pykakasi_data():
    import pykakasi
    pykakasi_path = os.path.dirname(pykakasi.__file__)
    data_path = os.path.join(pykakasi_path, 'data')
    
    # Collect all data files
    data_files = []
    for file in os.listdir(data_path):
        if file.endswith('.db'):
            src = os.path.join(data_path, file)
            dest = os.path.join('pykakasi', 'data')
            data_files.append((src, dest))
    
    return data_files

def main():
    # Build frontend first
    sp.run(args="npm run build", shell=True, cwd="frontend")

    data_files = get_pykakasi_data()
    data_args = []
    for src, dest in data_files:
        data_args.append('--add-data')
        data_args.append(f'{src}{os.pathsep}{dest}')

    # Build distributable
    pyinstaller.run([
        '--name=Spotidry',
        '--onefile',
        # '--no-console',
        f'--add-data=frontend/dist{os.pathsep}frontend/dist',
        f'--add-data=creds.toml{os.pathsep}.',
        '--hidden-import=spotdl',
        '--hidden-import=spotdl.download',
        '--hidden-import=spotdl.search',
        '--hidden-import=spotdl.utils',
        '--hidden-import=yt_dlp',
        '--hidden-import=spotipy',
        '--hidden-import=requests',
        '--hidden-import=urllib3',
        '--hidden-import=idna',
        '--hidden-import=pykakasi',
        *data_args,
        '-y',
        '--icon=frontend/public/static/SpotidryIcon.ico',
        'main.py'
    ])

if __name__ == "__main__":
    main()
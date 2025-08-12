import os
import subprocess as sp
from PyInstaller import __main__ as pyinstaller

def main():
    # Build frontend first
    sp.run(args="npm run build", shell=True, cwd="frontend")

    # Build distributable
    pyinstaller.run([
        '--name=Spotidry',
        '--onefile',
        f'--add-data=frontend/dist{os.pathsep}frontend/dist',
        f'--add-data=creds.toml{os.pathsep}.',
        '-y',
        'main.py'
    ])

if __name__ == "__main__":
    main()
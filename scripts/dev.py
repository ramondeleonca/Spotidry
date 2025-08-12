import subprocess as sp

PORT = 5678

def main():
    sp.Popen(f"npx vite dev --port {PORT}", cwd="frontend", shell=True)
    sp.Popen(f"py main.py --dev --port {PORT}", shell=True).wait()

if __name__ == "__main__":
    main()
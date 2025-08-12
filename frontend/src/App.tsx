import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce, useScroll } from "react-use"
import usePywebview from "./hooks/usePywebview";
import { Close, Download, Folder } from "@mui/icons-material";
import { motion } from "motion/react";
import LoadingIcons from 'react-loading-icons';

const idRegex = /(.+\/)|(\?.*)|(playlist|track|album)/gi
const typeRegex = /(playlist|track|album)/gi

function getArtistNames(artists) {
    let result = "";
    for (const artist of artists) {
        if (result.length > 0) result += ", ";
        result += artist.name;
    }
    return result;
}

export default function App() {
    // Pywebview interface
    const pywebview = usePywebview();

    // Message state for displaying messages to the user
    const [message, setMessage] = useState<string | null>("");

    // Folder selection logic
    const [selectedFolder, setSelectedFolder] = useState<string>("");
    useEffect(() => {
        if (!pywebview?.api?.getSelectedFolder) return;
        pywebview.api?.getSelectedFolder().then(folder => setSelectedFolder(folder as string)).catch(() => setSelectedFolder(""));
    }, [pywebview]);
    const chooseFolderCallback = useCallback(async () => setSelectedFolder(await pywebview?.api.chooseFolder() as string), [pywebview]);

    // API callbacks
    const closeCallback = useCallback(() => window.pywebview.api.close(), [pywebview]);
    
    // Spotify link input logic
    const [spotifyLink, setSpotifyLink] = useState<string>("");
    const [spotifyLinkResult, setSpotifyLinkResult] = useState<any>();
    useDebounce(async () => {
        if (spotifyLink.length < 5) return;
        const result = await pywebview?.api?.getFromLink(spotifyLink);
        setSpotifyLinkResult(result);
        console.log(result)
    }, 500, [spotifyLink]);

    // Scroll behavior
    const scrollRef = useRef<HTMLDivElement>(null);
    const { y: scrollY } = useScroll(scrollRef);

    // Download state tracking
    const [downloadState, setDownloadState] = useState<Record<string, never>>({});
    const [downloadStatus, setDownloadStatus] = useState<"idle" | "downloading" | "completed">("idle");

    return (
        <div className="w-screen h-screen relative flex flex-col overflow-hidden">
            <div className="pywebview-drag-region bg-[#0d0d0d] w-full h-8 flex items-center justify-between">
                <div className="flex px-2 gap-4 items-center">
                    <p className='font-bold'>Spotidry</p>
                    <p className='text-sm opacity-75 leading-0 text-center mt-1'>Waiting for downloads...</p>
                </div>
                <button className='aspect-square h-full cursor-pointer hover:*:scale-125' onClick={closeCallback}>
                    <Close></Close>
                </button>
            </div>

            <div className="w-full flex grow flex-col items-center px-4 pt-4">
                <input className="bg-[#1f1f1f] hover:bg-[#2a2a2a] transition-colors duration-200 px-4 py-2 rounded-full w-full" type="text" placeholder="Enter your Spotify link" value={spotifyLink} onChange={e => setSpotifyLink(e.target.value)}></input>
                <p className="text-xs mt-1 opacity-50">{spotifyLink?.match(typeRegex)?.[0].toUpperCase() ?? "Invalid type"} - {spotifyLink?.replace(idRegex, "") || "No ID found"}</p>

                <motion.div key={spotifyLinkResult?.id} className='my-4 flex self-start'>
                    <img className='h-20' src={spotifyLinkResult?.images?.at(-1)?.url}></img>
                    <div className='ml-2'>
                        <h1 className='text-xl font-medium leading-none'>{spotifyLinkResult?.name}</h1>
                        <p className='text-md opacity-75'>{spotifyLinkResult?.owner?.display_name}</p>
                    </div>
                </motion.div>

                <div className="w-full grow basis-0 min-h-0 relative flex flex-col">
                    {
                        spotifyLink && !spotifyLinkResult &&
                        <div className="top-0 left-0 right-0 bottom-0 z-20 absolute flex items-center justify-center">
                            <LoadingIcons.TailSpin></LoadingIcons.TailSpin>
                        </div>
                    }

                    <motion.div animate={{ opacity: scrollY > 0 ? 1 : 0 }} className="bg-gradient-to-b from-[#121212] to-transparent absolute top-0 left-0 right-0 h-8 z-10 pointer-events-none"></motion.div>

                        <div ref={scrollRef} className="w-full grow flex gap-2 flex-col overflow-y-auto overflow-x-hidden queue spotify-scroll">
                            {(spotifyLinkResult?.tracks?.items as Array<any>)?.map((track, i) => (
                                <motion.div className='flex' key={track.track.id + i} initial={{ opacity: 0, translateX: -25 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: i < 10 ? i * 0.05 : 0 }}>
                                    <div className='h-16 aspect-square relative'>
                                        <div className="absolute bg-black opacity-25 z-10 top-0 left-0 bottom-0 right-0 origin-right" style={{ transform: `scaleX(${downloadStatus == "downloading" ? 1 - (downloadState[track.track.id]["percent"] ?? 0) : 0})`}}></div>
                                        <img className='h-full w-full' src={track.track.album.images?.at(-1).url}></img>
                                    </div>
                                    <div className='ml-2'>
                                        <h1>{track.track.name}</h1>
                                        <p className='text-xs opacity-75'>{getArtistNames(track.track.artists)}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                    <motion.div animate={{ opacity: scrollY == ((scrollRef.current?.scrollHeight ?? 0) - (scrollRef.current?.clientHeight ?? 0)) ? 0 : 1 }} className="bg-gradient-to-t from-[#121212] to-transparent absolute bottom-0 left-0 right-0 h-8 z-10 pointer-events-none"></motion.div>
                </div>
            </div>

            <div className="w-full flex flex-col items-center justify-center p-4">
                <p>{message}</p>
                <p className='px-8 py-1 text-xs opacity-50 text-center leading-none mb-1'>Songs will be saved in {selectedFolder}</p>
                <div className="flex">
                    <button className="freeze-dry px-4 py-2 bg-[#1ed760] rounded-full hover:scale-105 active:scale-100 active:bg-[#18af4e] cursor-pointer font-medium">❄️ Freeze dry 🥶</button>
                    <button onClick={chooseFolderCallback} className="absolute right-4 py-2 px-3 aspect-square flex items-center justify-center bg-[#1ed760] rounded-full hover:scale-105 active:scale-100 active:bg-[#18af4e] cursor-pointer font-medium">
                        <Folder fontSize="small"></Folder>
                    </button>
                </div>
            </div>
        </div>
    )
}
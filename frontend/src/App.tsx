import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce, useScroll } from "react-use"
import usePywebview from "./hooks/usePywebview";
import { Close, Folder, PlayCircle, YouTube } from "@mui/icons-material";
import { motion } from "motion/react";
import LoadingIcons from 'react-loading-icons';

const idRegex = /(.+\/)|(\?.*)|(playlist|track|album)/gi
const typeRegex = /(playlist|track|album)/gi

export default function App() {
    // Pywebview interface
    const pywebview = usePywebview();

    // Message state for displaying messages to the user
    const [message, setMessage] = useState<string | null>("");

    // Folder selection logic
    const [selectedFolder, setSelectedFolder] = useState<string>("");
    // window["setSelectedFolder"] = setSelectedFolder;
    useEffect(() => {
        if (!pywebview?.api?.getSelectedFolder) return;
        pywebview.api?.getSelectedFolder().then(folder => setSelectedFolder(folder as string)).catch(() => setSelectedFolder(""));
    }, [pywebview]);
    const chooseFolderCallback = useCallback(async () => setSelectedFolder(await pywebview?.api.chooseFolder() as string), [pywebview]);
    
    // Spotify link input logic
    const [spotifyLink, setSpotifyLink] = useState<string>("");
    const [spotifyLinkResult, setSpotifyLinkResult] = useState<any>();
    useDebounce(async () => {
        if (spotifyLink.length < 5) {
            setSpotifyLinkResult(null);
            return
        }
        const result = await pywebview?.api?.getFromLink(spotifyLink);
        setSpotifyLinkResult(result);
        console.log(result)
    }, 500, [spotifyLink]);
    const spotitype = spotifyLinkResult?.type ?? "album";

    // Scroll behavior
    const scrollRef = useRef<HTMLDivElement>(null);
    const { y: scrollY } = useScroll(scrollRef);

    // Search state
    const [searchState, setSearchState] = useState<Record<string, any>>({});
    window["setSearchState"] = setSearchState;

    // Download state tracking
    const [downloadState, setDownloadState] = useState<Record<string, any>>({});
    window["setDownloadState"] = setDownloadState;

    const [downloadStatus, setDownloadStatus] = useState<"idle" | "downloading" | "completed">("idle");
    window["setDownloadStatus"] = setDownloadStatus;

    // API callbacks
    const closeCallback = useCallback(() => pywebview.api.close(), [pywebview]);

    const [freezeDrying, setFreezeDrying] = useState<boolean>(false);
    const freezeDryCallback = useCallback(async () => {
        let result: unknown;
        try {
            setFreezeDrying(true);
            result = await pywebview.api.freezeDry(spotifyLink);
        } catch (error) {
            console.error("Error during freeze dry:", error);
            setMessage("An error occurred while trying to freeze dry the songs.");
            setFreezeDrying(false);
            return;
        }
        setFreezeDrying(false);
        console.log(result)
    }, [pywebview, spotifyLink]);

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

            {
                spotifyLink && !spotifyLinkResult &&
                <div className="top-0 left-0 right-0 bottom-0 z-20 absolute flex items-center justify-center">
                    <LoadingIcons.TailSpin></LoadingIcons.TailSpin>
                </div>
            }


            <div className="w-full flex grow flex-col items-center px-4 pt-4">
                <input className="bg-[#1f1f1f] hover:bg-[#2a2a2a] transition-colors duration-200 px-4 py-2 rounded-full w-full" type="text" placeholder="Enter your Spotify link" value={spotifyLink} onChange={e => setSpotifyLink(e.target.value)}></input>
                <p className="text-xs mt-1 opacity-50">{spotifyLink?.match(typeRegex)?.[0].toUpperCase() ?? "Invalid type"} - {spotifyLink?.replace(idRegex, "") || "No ID found"}</p>

                {
                    spotitype == "track" ? (
                        <>
                            <motion.div key={spotifyLinkResult?.id} className='my-4 flex flex-col items-center'>
                                <img className='h-40' src={spotifyLinkResult?.album?.images?.at(-2)?.url}></img>
                                <div className='mt-2'>
                                    <a href={spotifyLinkResult?.external_urls?.spotify ?? ""} className='text-2xl font-medium leading-none hover:underline'>{spotifyLinkResult?.name}</a>
                                    <div className='flex flex-wrap gap-x-1 justify-center'>
                                        {
                                            spotifyLinkResult?.artists.map((artist, i: number , arr: []) => (
                                                <a key={artist.name + i} href={artist.external_urls.spotify} className='hover:underline opacity-75' target='_blank'>{artist.name + (i == arr.length - 1 ? "" : ", ")}</a>
                                            ))
                                        }
                                    </div>
                                </div>
                            </motion.div>
                        </>
                    ) : (
                        <>
                            <motion.div key={spotifyLinkResult?.id} className='my-4 flex self-start'>
                                <img className='h-20' src={spotifyLinkResult?.images?.at(-1)?.url}></img>
                                <div className='ml-2'>
                                    <a href={spotifyLinkResult?.external_urls?.spotify ?? ""} className='text-xl font-medium leading-none hover:underline'>{spotifyLinkResult?.name}</a>
                                    <div className='flex flex-wrap gap-x-1'>
                                        {
                                            spotitype == "album" ? spotifyLinkResult?.artists.map((artist, i: number , arr: []) => (
                                                <a key={artist.name + i} href={artist.external_urls.spotify} className='hover:underline opacity-75' target='_blank'>{artist.name + (i == arr.length - 1 ? "" : ", ")}</a>
                                            )) : (
                                                <p className='text-md opacity-75'>{spotifyLinkResult?.owner?.display_name}</p>
                                            )
                                        }
                                    </div>
                                </div>
                            </motion.div>

                            <div className="w-full grow basis-0 min-h-0 relative flex flex-col">
                                <motion.div animate={{ opacity: scrollY > 0 ? 1 : 0 }} className="bg-gradient-to-b from-[#121212] to-transparent absolute top-0 left-0 right-0 h-8 z-10 pointer-events-none"></motion.div>

                                    <div ref={scrollRef} className="w-full grow flex gap-2 flex-col overflow-y-auto overflow-x-hidden queue spotify-scroll">
                                        {(spotifyLinkResult?.tracks?.items as Array<any>)?.map((spotifyTrack, i) => {
                                            const track = spotitype == "album" ? spotifyTrack : spotifyTrack.track;
                                            return (
                                                <motion.div className='w-full' key={track.id + i} initial={{ opacity: 0, translateX: -25 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: i < 10 ? i * 0.05 : 0 }}>
                                                    <motion.div className='flex pr-2 w-full justify-between' animate={{ /*opacity: track?.id in searchState ? 1 : 0.5*/ }}>
                                                        <div className="flex">
                                                            {/* Cover image */}
                                                            <a href={searchState[track.id]?.url} target='_blank' className='h-16 w-16 relative'>
                                                                {
                                                                    searchState[track.id]?.url && 
                                                                    <div className="play-overlay absolute z-10 top-0 left-0 bottom-0 right-0 flex items-center justify-center opacity-0 hover:opacity-100">
                                                                        <PlayCircle fontSize='large'></PlayCircle>
                                                                    </div>
                                                                }
                                                                <div className="absolute bg-black opacity-25 z-10 top-0 left-0 bottom-0 right-0 origin-right" style={{ transform: `scaleX(${downloadStatus == "downloading" ? 1 - (downloadState[track.id]["percent"] ?? 0) : 0})`}}></div>
                                                                <img className='h-full w-full' src={spotitype == "album" ? spotifyLinkResult?.images?.at(-1)?.url : track?.album?.images?.at(-1).url}></img>
                                                            </a>
                                                            
                                                            {/* Track info */}
                                                            <div className='ml-2'>
                                                                <a href={track.external_urls.spotify ?? "#"} target="_blank" className='hover:underline'>{track.name}</a>
                                                                <div className="flex flex-wrap basis-0 grow gap-x-1">
                                                                    {track.artists.map((artist, i: number , arr: []) => (
                                                                        <a key={artist.name + i} href={artist.external_urls.spotify} className='hover:underline opacity-75' target='_blank'>{artist.name + (i == arr.length - 1 ? "" : ", ")}</a>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Icons */}
                                                        {/* <div className='icon-bar flex flex-col items-center gap-1 w-8 justify-self-end'>
                                                            <YouTube></YouTube>
                                                        </div> */}
                                                    </motion.div>
                                                </motion.div>
                                            )
                                        })}
                                    </div>

                                <motion.div animate={{ opacity: scrollY == ((scrollRef.current?.scrollHeight ?? 0) - (scrollRef.current?.clientHeight ?? 0)) ? 0 : 1 }} className="bg-gradient-to-t from-[#121212] to-transparent absolute bottom-0 left-0 right-0 h-8 z-10 pointer-events-none"></motion.div>
                            </div>
                        </>
                    )
                }

            </div>

            <div className="w-full flex flex-col items-center justify-center p-4">
                <p className='text-center w-full text-xs leading-none'>{message}</p>
                {/* TODO: ONLY SHOW IF DEFINED */}
                <p className='px-8 py-1 text-xs opacity-50 text-center leading-none mb-1'>Songs will be saved in {selectedFolder/* + (spotifyLinkResult ? ((selectedFolder.includes("\\") ? "\\" : "/") + spotifyLinkResult?.name) : "")*/}</p>
                <div className="flex">
                    <button onClick={freezeDryCallback} disabled={freezeDrying} className={`freeze-dry relative px-4 py-2 bg-[#1ed760] rounded-full hover:scale-105 active:scale-100 active:bg-[#18af4e] cursor-pointer font-medium ${freezeDrying ? "pointer-events-none opacity-75" : ""}`}>
                        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center pointer-events-none">
                            {freezeDrying && <LoadingIcons.TailSpin className='scale-75'></LoadingIcons.TailSpin>}
                        </div>
                        <p style={{ filter: `opacity(${freezeDrying ? 0 : 1})`}}>❄️ Freeze dry 🥶</p>
                    </button>
                    <button onClick={chooseFolderCallback} disabled={freezeDrying} className="absolute right-4 py-2 px-3 aspect-square flex items-center justify-center bg-[#1ed760] rounded-full hover:scale-105 active:scale-100 active:bg-[#18af4e] cursor-pointer font-medium">
                        <Folder fontSize="small"></Folder>
                    </button>
                </div>
            </div>
        </div>
    )
}
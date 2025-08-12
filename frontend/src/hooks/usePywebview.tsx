import { useEffect, useState } from "react";
import { Pywebview, PywebviewAPI } from "./pywebview-types";

export default function usePywebview<API extends PywebviewAPI = PywebviewAPI>() {
    const [pywebview, setPywebview] = useState<Pywebview<API> | null>(window?.pywebview as Pywebview<API> ?? null);

    useEffect(() => {
        const handlePywebviewReady = () => setPywebview(window.pywebview as Pywebview<API>);

        if (window?.pywebview) setPywebview(window.pywebview as Pywebview<API>);
        else window.addEventListener("pywebviewready", handlePywebviewReady as EventListener);

        return () => { window.removeEventListener("pywebviewready", handlePywebviewReady as EventListener) };
    }, []);

    return pywebview;
}
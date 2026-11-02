document.addEventListener("DOMContentLoaded", () => {
    const libraryGrid = document.getElementById("libraryGrid");
    const emptyLibraryMsg = document.getElementById("emptyLibraryMsg");
    const downloadStatusBar = document.getElementById("downloadStatusBar");
    const downloadingGameName = document.getElementById("downloadingGameName");
    let downloadStatusTimer;
    let library;
    try {
        const savedLibrary = JSON.parse(localStorage.getItem("brickStoreLibrary") || "[]");
        library = Array.isArray(savedLibrary)
            ? savedLibrary.filter(item => item && typeof item === "object"
                && typeof item.name === "string" && typeof item.img === "string")
            : [];
        const hasSimulatedInstallStatus = library.some(item => item.status === "Installed" || item.status === "Downloaded");
        if (hasSimulatedInstallStatus) {
            library.forEach(item => {
                if (item.status === "Installed" || item.status === "Downloaded") delete item.status;
            });
            localStorage.setItem("brickStoreLibrary", JSON.stringify(library));
        }
    } catch (error) {
        console.error("Could not read the library data.", error);
        library = [];
    }
    function renderLibrary() {
        if (!libraryGrid) return;
        libraryGrid.innerHTML = "";

        if (library.length === 0) {
            if (emptyLibraryMsg) emptyLibraryMsg.style.display = "block";
            return;
        }

        if (emptyLibraryMsg) emptyLibraryMsg.style.display = "none";
        library.forEach((item, index) => {
            const card = document.createElement("div");
            card.className = "game-card";

            const image = document.createElement("img");
            image.src = item.img;
            image.alt = item.name;

            const title = document.createElement("h3");
            title.textContent = item.name;

            const status = document.createElement("span");
            status.className = "badge-free";
            status.textContent = translate("ready");

            const progressPercentage = document.createElement("div");
            progressPercentage.className = "download-percentage";
            progressPercentage.textContent = "0%";

            const progressContainer = document.createElement("div");
            progressContainer.className = "download-progress-container";
            const progressBar = document.createElement("div");
            progressBar.className = "download-progress-bar";
            progressContainer.appendChild(progressBar);

            const buttons = document.createElement("div");
            buttons.className = "card-buttons";

            const downloadButton = document.createElement("button");
            downloadButton.className = "btn-download";
            downloadButton.dataset.index = String(index);
            downloadButton.textContent = translate("download");

            const removeButton = document.createElement("button");
            removeButton.className = "btn-remove";
            removeButton.dataset.index = String(index);
            removeButton.textContent = "-";
            removeButton.setAttribute("aria-label", `${translate("removeFromLibrary")} ${item.name}`);

            buttons.append(downloadButton, removeButton);
            card.append(image, title, status, progressPercentage, progressContainer, buttons);
            libraryGrid.appendChild(card);
        });
    }

    function saveLibrary() {
        localStorage.setItem("brickStoreLibrary", JSON.stringify(library));
    }

    function showDownloadMessage(key) {
        if (!downloadStatusBar || !downloadingGameName) return;
        window.clearTimeout(downloadStatusTimer);
        downloadStatusBar.style.display = "block";
        downloadingGameName.textContent = translate(key);
        downloadStatusTimer = window.setTimeout(() => {
            downloadStatusBar.style.display = "none";
        }, 5000);
    }

    function candidateArchiveFiles(name) {
        const base = String(name || "").trim();
        if (!base) return [];
        return [`${base}.zip`, base];
    }

    async function findArchive(name) {
        for (const fileName of candidateArchiveFiles(name)) {
            const url = new URL(`store/downloads/${encodeURIComponent(fileName)}`, document.baseURI).href;
            if (window.location.protocol === "file:") return { url, bytes: 0 };
            try {
                const response = await fetch(url, { method: "HEAD" });
                if (response.ok) {
                    return { url, bytes: Number(response.headers.get("content-length")) || 0 };
                }
            } catch (error) {
                console.warn(`Could not check the local package ${fileName}.`, error);
            }
        }
        return null;
    }

    function confirmLargeDownload(name, bytes) {
        const size = bytes || window.BrickStoreDownloads.getArchiveSize(name);
        const threshold = Number(localStorage.getItem("brickStoreLargeDownloadThreshold") || 100);
        const sizeMb = size ? Math.ceil(size / (1024 * 1024)) : 0;
        if (!threshold || sizeMb <= threshold) return true;
        return window.confirm(translate("largeDownloadConfirm")
            .replace("{name}", name)
            .replace("{size}", sizeMb));
    }

    async function downloadItem(index, button) {
        const item = library[index];
        if (!item) return;

        const archive = await findArchive(item.name);
        if (!archive) {
            showDownloadMessage("downloadPackageUnavailable");
            return;
        }

        if (!confirmLargeDownload(item.name, archive.bytes)) return;
        button.disabled = true;
        try {
            const link = document.createElement("a");
            link.href = archive.url;
            link.download = decodeURIComponent(new URL(archive.url).pathname.split("/").pop());
            document.body.appendChild(link);
            link.click();
            link.remove();
            showDownloadMessage("downloadRequested");
        } catch (error) {
            console.error(`Could not start the download for ${item.name}.`, error);
            showDownloadMessage("downloadPackageUnavailable");
        } finally {
            button.disabled = false;
        }
    }

    libraryGrid.addEventListener("click", event => {
        const button = event.target.closest("button");
        if (!button) return;
        const index = Number(button.dataset.index);
        if (!Number.isInteger(index) || index < 0 || index >= library.length) return;
        if (button.classList.contains("btn-remove")) {
            library.splice(index, 1);
            saveLibrary();
            renderLibrary();
        } else if (button.classList.contains("btn-download")) {
            downloadItem(index, button);
        }
    });

    renderLibrary();
});

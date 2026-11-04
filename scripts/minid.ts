document.addEventListener("DOMContentLoaded", function () {
    const tbVoice = document.getElementById('tauntbotvoice');
    const contextWindow = document.getElementById('context');
    const slashText = document.getElementById('chattextboxslash');
    const placeholderText = document.getElementById('chattextboxph');
    const joinSnd = new Audio('/assets/audio/fluxer/user-join.mp3');
    const leaveSnd = new Audio('/assets/audio/fluxer/user-leave.mp3');

    function setVisibility(el: HTMLElement | null, visible: boolean) {
        el && (el.style.display = visible ? 'block' : 'none');
    }

    function uiShowHide(reset: boolean) {
        setVisibility(tbVoice, !reset);
        setVisibility(placeholderText, !reset);
        setVisibility(slashText, reset);
        setTimeout(() => setVisibility(contextWindow, reset), reset ? 500 : 0);
    }

    function createAudio(cmd: string) {
        switch (cmd) {
            case 'mvp':
                return new Audio('/assets/audio/noise-maker.mp3');
            case 'lose':
                return new Audio('/assets/audio/sad_trombone.mp3');
            case 'win':
                return new Audio('/assets/audio/wano.mp3');
            default:
                throw new Error('invalid command');
        }
    }

    function selectCommand(cmd: string) {
        const audio = createAudio(cmd);
        setTimeout(() => audio.play(), 400);
        audio.addEventListener('ended', _e => {
            leaveSnd.play();
            uiShowHide(true);
        });
        joinSnd.play();
        uiShowHide(false);
    }

    document.querySelectorAll('#context #commands .cmdListing').forEach((el, _key, _parent) => {
        el.addEventListener('click', _e => selectCommand((el as HTMLDivElement).dataset['cmd'] ?? ''))
    });

});

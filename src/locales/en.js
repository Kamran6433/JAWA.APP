// English text for the desktop shell. The pages themselves come from the
// live sites and carry their own translations.
export default {
  menu: {
    about: "About %{app}",
    file: "File",
    edit: "Edit",
    view: "View",
    history: "History",
    back: "Back",
    forward: "Forward",
    home: "Home",
    window: "Window",
  },
  context: {
    open_link: "Open link in browser",
    copy_link: "Copy link",
    no_suggestions: "No spelling suggestions",
  },
  offline: {
    retry: "Try again",
    offline: {
      title: "%{app} can’t connect",
      body: "Check this computer’s internet connection. %{app} will try again on its own.",
    },
    insecure: {
      title: "This connection isn’t secure",
      body: "%{app} couldn’t confirm it was talking to the real JAWA server, so it stopped. Check this computer’s date and time, or try another network.",
    },
  },
  serial: {
    title: "Choose a caller ID adapter",
    message: "Choose the adapter connected to your phone line.",
    none: "No caller ID adapter is plugged in. Connect it, then try again.",
    cancel: "Cancel",
  },
  startup: {
    title: "JAWA can’t start",
    body: "This copy of the app is damaged. Download it again from JAWA.",
  },
};

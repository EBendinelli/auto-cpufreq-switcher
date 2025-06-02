import GLib from "gi://GLib";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import {
  QuickMenuToggle,
  SystemIndicator,
} from "resource:///org/gnome/shell/ui/quickSettings.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

const AUTO_CPUFREQ_GOVERNORS = {
  balanced: {
    name: "Balanced",
    iconName: "power-profile-balanced-symbolic",
    command: "pkexec auto-cpufreq --force=reset",
  },
  powersave: {
    name: "Powersave",
    iconName: "power-profile-power-saver-symbolic",
    command: "pkexec auto-cpufreq --force=powersave",
  },
  performance: {
    name: "Performance",
    iconName: "power-profile-performance-symbolic",
    command: "pkexec auto-cpufreq --force=performance",
  },
};

const RETRY_DELAY = 1000;
const MAX_RETRIES = 3;

const GovernorToggle = GObject.registerClass(
  {
    Properties: {
      "active-governor": GObject.ParamSpec.string(
        "active-governor",
        "Active Governor",
        "The currently active CPU governor",
        GObject.ParamFlags.READWRITE,
        null
      ),
    },
  },
  class GovernorToggle extends QuickMenuToggle {
    _init(path) {
      super._init({ title: "CPU Governor" });

      this._governorItems = new Map();
      this._activeGovernor = null;
      this._retryTimeoutId = null;
      this._path = path;
      this.headerIcon = Gio.icon_new_for_string(
        `${this._path}/ico/processor-symbolic.svg`
      );
      this._governorSection = new PopupMenu.PopupMenuSection();
      this.menu.addMenuItem(this._governorSection);
      this.menu.setHeader(this.headerIcon, "CPU Governor");
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      this._addGovernorToggles(Object.keys(AUTO_CPUFREQ_GOVERNORS));
      this._fetchCurrentGovernor();
    }

    _fetchCurrentGovernor() {
      console.log("EXTENSION:Fetching current governor");
      this._executeCommandWithRetry(
        ["timeout", "1s", "auto-cpufreq", "--stats"],
        (stdout) => {
          // Try to detect the current governor from the output
          let found = false;
          console.log(stdout.includes("Warning"));
          if (stdout.includes("Warning")){
            //If Warning is present the governor was overriden manually and we check what it is set to
            const governorStatusText = stdout.match(/Setting to use:\s*"([^"]+)"/);
            console.log(governorStatusText);
            const currentGovernor = governorStatusText ? governorStatusText[1] : null;
            this._setActiveGovernor(currentGovernor);
            found = true;
          }else{
            //Otherwise it means governor is set to balanced
            this._setActiveGovernor("balanced");

          }
        },
        () => {
          console.error(
            "Failed to fetch current governor after multiple attempts"
          );
          this._setActiveGovernor("balanced");
        }
      );
    }

    _executeCommand(command, onSuccess, onFailure, retryCount = 0) {
        try {
        let proc = Gio.Subprocess.new(
          command,
          Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        proc.communicate_utf8_async(null, null, (proc, res) => {
          try {
            let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
            let success = false;
            try {
              success = proc.get_successful();
            } catch (e) {
              success = false;
            }
            // If not successful, or if stderr contains pkexec/sudo error, treat as failure
            if (success && (!stderr || stderr.trim() === "")) {
              onSuccess(stdout);
            } else {
              console.log(stderr);
              onFailure(stderr);
            }
          } catch (e) {
            onFailure(e.message);
          }
        });
      } catch (e) {
        onFailure(e.message);
      }
    }

    _executeCommandWithRetry(command, onSuccess, onFailure, retryCount = 0) {
      try {
        let proc = Gio.Subprocess.new(
          command,
          Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        proc.communicate_utf8_async(null, null, (proc, res) => {
          try {
            let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
            if (ok) {

              onSuccess(stdout);
            } else if (retryCount < MAX_RETRIES) {
              this._retryTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                RETRY_DELAY,
                () => {
                  this._executeCommandWithRetry(
                    command,
                    onSuccess,
                    onFailure,
                    retryCount + 1
                  );
                  this._retryTimeoutId = null;
                  return GLib.SOURCE_REMOVE;
                }
              );
            } else {
              onFailure();
            }
          } catch (e) {
            onFailure();
          }
        });
      } catch (e) {
        onFailure();
      }
    }

    _clearRetryTimeout() {
      if (this._retryTimeoutId !== null) {
        GLib.source_remove(this._retryTimeoutId);
        this._retryTimeoutId = null;
      }
    }

    _addGovernorToggles(governors) {
      for (const governor of governors) {
        const params = AUTO_CPUFREQ_GOVERNORS[governor];
        const item = new PopupMenu.PopupImageMenuItem(
          params.name,
          params.iconName
        );
        item.connect("activate", () => {
          console.log(`Activating governor: ${governor}`);
          this._activateGovernor(governor, params.command);
        });
        this._governorItems.set(governor, item);
        this._governorSection.addMenuItem(item);
      }
    }

    _activateGovernor(governor, command) {
      if (governor === this._activeGovernor) {
        return;
      }
      this._executeCommand(
        ["sh", "-c", command],
        () => {
          this._setActiveGovernor(governor);
          Main.notify(
            "CPU Governor Switcher",
            `${AUTO_CPUFREQ_GOVERNORS[governor].name} governor activated successfully.`
          );
        },
        (error) => {
          Main.notify(
            "CPU Governor Switcher",
            `Failed to switch to ${AUTO_CPUFREQ_GOVERNORS[governor].name} governor.\n${error ? error : 'Please try again or check system logs.'}`
          );
        }
      );
    }

    _setActiveGovernor(governor) {
      if (AUTO_CPUFREQ_GOVERNORS[governor]) {
        this._activeGovernor = governor;
        this.notify("active-governor");
        this._sync();
      }
    }

    get activeGovernor() {
      return this._activeGovernor;
    }

    _sync() {
      const params = AUTO_CPUFREQ_GOVERNORS[this._activeGovernor];
      if (!params) return;
      for (const [governor, item] of this._governorItems) {
        item.setOrnament(
          governor === this._activeGovernor
            ? PopupMenu.Ornament.CHECK
            : PopupMenu.Ornament.NONE
        );
      }
      this.set({ subtitle: params.name, iconName: params.iconName });
      this.checked = this._activeGovernor !== "balanced";
    }

    destroy() {
      this._clearRetryTimeout();
      super.destroy();
    }
  }
);

export const Indicator = GObject.registerClass(
  class Indicator extends SystemIndicator {
    _init(path) {
      super._init();
      this._indicator = this._addIndicator();
      this._indicator.icon_name = "cpu-symbolic";
      this.indicatorIndex = 0;
      this._toggle = new GovernorToggle(path);
      this.quickSettingsItems.push(this._toggle);
      this._toggle.connect(
        "notify::active-governor",
        this._updateIcon.bind(this)
      );
      this._insertIndicator();
      this._updateIcon();
    }
    _insertIndicator() {
      const QuickSettingsMenu = Main.panel.statusArea.quickSettings;
      if (QuickSettingsMenu && QuickSettingsMenu._indicators) {
        QuickSettingsMenu._indicators.insert_child_at_index(
          this,
          this.indicatorIndex
        );
      }
    }
    _updateIcon() {
      const activeGovernor = this._toggle.activeGovernor;
      if (activeGovernor && AUTO_CPUFREQ_GOVERNORS[activeGovernor]) {
        const params = AUTO_CPUFREQ_GOVERNORS[activeGovernor];
        this._indicator.icon_name = params.iconName;
        this._indicator.visible = true;
      } else {
        this._indicator.icon_name = "cpu-symbolic";
        this._indicator.visible = true;
      }
    }
  }
);

export default class AutoCpufreqSwitcherExtension extends Extension {
  enable() {
    this._indicator = new Indicator(this.path);
    Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
  }
  disable() {
    if (this._indicator) {
      this._indicator.quickSettingsItems.forEach((item) => {
        item.destroy();
      });
      const parent = this._indicator.get_parent();
      if (parent) {
        parent.remove_child(this._indicator);
      }
      this._indicator.destroy();
      this._indicator = null;
    }
  }
}

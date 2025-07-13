# Auto-cpufreq Switcher

>[!CAUTION]
> This is a work in progress. Use at your own risks!

A Gnome-shell extension to manually switch [Auto-cpufreq](https://github.com/AdnanHodzic/auto-cpufreq) governor. Note that your password will be requested as auto-cpufreq commands are run with `sudo`.

Currently tested on Arch / Gnome 48 / Wayland
auto-cpufreq v2.6.0

Only supports default modes :
- Balanced
- Powersaver
- Performance

![screenshot example](./img/screenshot.png)

## Installation

### Using release package

- Donwload zip file form [the latest release](https://github.com/EBendinelli/auto-cpufreq-switcher/releases)
- Install with `gnome-extensions install ~/Download/auto-cpufreq-switcher@ebdendinelli.github.io.zip`
- Enable with `gnome-extensions enable auto-cpufreq-switcher@ebdendinelli.github.io.zip`

### Using Git Clone
- Install [auto-cpufreq](https://github.com/AdnanHodzic/auto-cpufreq)
- Clone this repo `git clone https://github.com/EBendinelli/auto-cpufreq-switcher.git`
- Copy 
    ```bash
    cp -rf auto-cpufreq-switcher ~/.local/share/gnome-shell/extensions/auto-cpufreq-switcher@ebdendinelli.github.io
    ```
- Enable extension: `gnome-extensions enable auto-cpufreq-switcher@ebdendinelli.github.io`

## Credits

Heavily inspired by [GPU-Supergfxctl-Switch](https://github.com/chikobara/GPU-Switcher-Supergfxctl/)

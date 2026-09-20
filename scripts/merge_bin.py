"""
PlatformIO Post-Build Script: merge_bin.py
Automatically merges bootloader.bin, partitions.bin, boot_app0.bin (if present),
and firmware.bin into a single flashable binary at offset 0x0:
esp32c3_st7789_merged_0x0.bin
"""

Import("env")
import os
import sys

def merge_bin_action(source, target, env):
    build_dir = env.subst("$BUILD_DIR")
    firmware = os.path.join(build_dir, "firmware.bin")
    bootloader = os.path.join(build_dir, "bootloader.bin")
    partitions = os.path.join(build_dir, "partitions.bin")
    out_merged = os.path.join(build_dir, "esp32c3_st7789_merged_0x0.bin")

    flash_mode = env.get("BOARD_FLASH_MODE", "dio")
    flash_freq = env.subst("$BOARD_F_FLASH").replace("L", "")
    flash_size = env.get("BOARD_FLASH_SIZE", "4MB")

    # Check for boot_app0 in framework packages
    cmd = [
        sys.executable,
        "-m", "esptool",
        "--chip", "esp32c3",
        "merge_bin",
        "-o", out_merged,
        "--flash_mode", flash_mode,
        "--flash_freq", flash_freq,
        "--flash_size", flash_size,
        "0x0000", bootloader,
        "0x8000", partitions
    ]

    try:
        platform = env.PioPlatform()
        framework_dir = platform.get_package_dir("framework-arduinoespressif32")
        if framework_dir:
            boot_app0 = os.path.join(framework_dir, "tools", "partitions", "boot_app0.bin")
            if os.path.exists(boot_app0):
                cmd.extend(["0xe000", boot_app0])
    except Exception as e:
        print(f"[MERGE_BIN INFO] Optional boot_app0 lookup skipped: {e}")

    cmd.extend(["0x10000", firmware])

    print("\n[MERGE_BIN] Generating single 0x0 merged binary:")
    print(" ".join(cmd))
    result = env.Execute(" ".join(cmd))
    if result == 0:
        print(f"\n[MERGE_BIN SUCCESS] Created: {out_merged}\n")
    else:
        print("\n[MERGE_BIN ERROR] Failed to merge binary!\n")

env.AddPostAction("$BUILD_DIR/${PROGNAME}.bin", merge_bin_action)

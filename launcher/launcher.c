#include <windows.h>
#include <wchar.h>

int WINAPI wWinMain(HINSTANCE inst, HINSTANCE prev, PWSTR args, int show) {
  wchar_t root[MAX_PATH], exe[MAX_PATH], cmd[3 * MAX_PATH];
  GetModuleFileNameW(NULL, root, MAX_PATH);
  wchar_t *slash = wcsrchr(root, L'\\');
  if (slash) *slash = 0;
  _snwprintf(exe, MAX_PATH, L"%ls\\app\\node_modules\\electron\\dist\\electron.exe", root);
  if (GetFileAttributesW(exe) == INVALID_FILE_ATTRIBUTES) {
    ShellExecuteW(NULL, L"open", L"start.bat", NULL, root, SW_SHOWNORMAL);
    return 0;
  }
  _snwprintf(cmd, 3 * MAX_PATH, L"\"%ls\" \"%ls\\app\" --workspace=\"%ls\"", exe, root, root);
  STARTUPINFOW si = { sizeof(si) };
  PROCESS_INFORMATION pi;
  if (CreateProcessW(NULL, cmd, NULL, NULL, FALSE, 0, NULL, root, &si, &pi)) {
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
  }
  return 0;
}

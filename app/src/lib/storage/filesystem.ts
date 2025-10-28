// File System Access API Wrapper
import { PermissionError, StorageError } from '../../types';
import { sanitizeFilename, ensurePathLength } from '../utils';

export interface DirectoryOptions {
  startIn?: 'desktop' | 'documents' | 'downloads';
  mode?: 'read' | 'readwrite';
}

export class FileSystemManager {
  private rootHandle: FileSystemDirectoryHandle | null = null;

  /**
   * Check if File System Access API is supported
   */
  isSupported(): boolean {
    return 'showDirectoryPicker' in window;
  }

  /**
   * Show directory picker and get user-selected directory
   */
  async selectDirectory(options: DirectoryOptions = {}): Promise<{
    handle: FileSystemDirectoryHandle;
    path: string;
  }> {
    if (!this.isSupported()) {
      throw new StorageError('File System Access API not supported');
    }

    try {
      const handle = await window.showDirectoryPicker({
        mode: options.mode || 'readwrite',
        startIn: options.startIn || 'documents',
      });

      this.rootHandle = handle;

      // Get display path (name only, can't get full path)
      const path = handle.name;

      return { handle, path };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new PermissionError('Directory selection cancelled');
      }
      throw new PermissionError(`Failed to select directory: ${error.message}`);
    }
  }

  /**
   * Set the root directory handle
   */
  setRootHandle(handle: FileSystemDirectoryHandle): void {
    this.rootHandle = handle;
  }

  /**
   * Get the root directory handle
   */
  getRootHandle(): FileSystemDirectoryHandle | null {
    return this.rootHandle;
  }

  /**
   * Verify we have permission to access the directory
   */
  async verifyPermission(
    handle: FileSystemDirectoryHandle,
    mode: 'read' | 'readwrite' = 'readwrite'
  ): Promise<boolean> {
    const options = { mode };

    // Check if we already have permission
    if ((await handle.queryPermission(options)) === 'granted') {
      return true;
    }

    // Request permission
    if ((await handle.requestPermission(options)) === 'granted') {
      return true;
    }

    return false;
  }

  /**
   * Request permission for root directory
   */
  async requestPermission(): Promise<boolean> {
    if (!this.rootHandle) {
      throw new PermissionError('No directory selected');
    }

    return this.verifyPermission(this.rootHandle, 'readwrite');
  }

  /**
   * Get or create a directory (nested paths supported)
   */
  async getDirectory(
    path: string[],
    create: boolean = true
  ): Promise<FileSystemDirectoryHandle> {
    if (!this.rootHandle) {
      throw new PermissionError('No root directory set');
    }

    let currentHandle = this.rootHandle;

    for (const segment of path) {
      // Sanitize each path segment
      const sanitized = sanitizeFilename(segment);
      
      try {
        currentHandle = await currentHandle.getDirectoryHandle(sanitized, { create });
      } catch (error: any) {
        if (error.name === 'NotFoundError' && !create) {
          throw new StorageError(`Directory not found: ${path.join('/')}`);
        }
        throw new StorageError(`Failed to access directory: ${error.message}`);
      }
    }

    return currentHandle;
  }

  /**
   * Write a file to the specified directory
   */
  async writeFile(
    dirPath: string[],
    filename: string,
    content: Blob | string | ArrayBuffer
  ): Promise<void> {
    try {
      // Get the directory (create if needed)
      const dirHandle = await this.getDirectory(dirPath, true);

      // Sanitize filename
      const sanitizedFilename = sanitizeFilename(filename);

      // Ensure path length doesn't exceed limits
      const fullPath = [...dirPath, sanitizedFilename].join('/');
      ensurePathLength(fullPath);

      // Get file handle
      const fileHandle = await dirHandle.getFileHandle(sanitizedFilename, { create: true });

      // Create writable stream
      const writable = await fileHandle.createWritable();

      // Write content
      if (typeof content === 'string') {
        await writable.write(content);
      } else if (content instanceof Blob) {
        await writable.write(content);
      } else if (content instanceof ArrayBuffer) {
        await writable.write(content);
      }

      // Close the stream
      await writable.close();
    } catch (error: any) {
      if (error.name === 'QuotaExceededError') {
        throw new StorageError('Storage quota exceeded');
      }
      if (error.name === 'NotAllowedError') {
        throw new PermissionError('Write permission denied');
      }
      throw new StorageError(`Failed to write file: ${error.message}`);
    }
  }

  /**
   * Write a file with streaming support (for large files)
   */
  async writeFileStreaming(
    dirPath: string[],
    filename: string,
    stream: ReadableStream<Uint8Array>
  ): Promise<void> {
    try {
      const dirHandle = await this.getDirectory(dirPath, true);
      const sanitizedFilename = sanitizeFilename(filename);
      const fileHandle = await dirHandle.getFileHandle(sanitizedFilename, { create: true });
      const writable = await fileHandle.createWritable();

      // Pipe the stream
      await stream.pipeTo(writable);
    } catch (error: any) {
      if (error.name === 'QuotaExceededError') {
        throw new StorageError('Storage quota exceeded');
      }
      if (error.name === 'NotAllowedError') {
        throw new PermissionError('Write permission denied');
      }
      throw new StorageError(`Failed to write file (streaming): ${error.message}`);
    }
  }

  /**
   * Read a file from the directory
   */
  async readFile(dirPath: string[], filename: string): Promise<File> {
    try {
      const dirHandle = await this.getDirectory(dirPath, false);
      const sanitizedFilename = sanitizeFilename(filename);
      const fileHandle = await dirHandle.getFileHandle(sanitizedFilename);
      return await fileHandle.getFile();
    } catch (error: any) {
      throw new StorageError(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(dirPath: string[], filename: string): Promise<boolean> {
    try {
      const dirHandle = await this.getDirectory(dirPath, false);
      const sanitizedFilename = sanitizeFilename(filename);
      await dirHandle.getFileHandle(sanitizedFilename);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(dirPath: string[], filename: string): Promise<void> {
    try {
      const dirHandle = await this.getDirectory(dirPath, false);
      const sanitizedFilename = sanitizeFilename(filename);
      await dirHandle.removeEntry(sanitizedFilename);
    } catch (error: any) {
      throw new StorageError(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Delete a directory and all its contents
   */
  async deleteDirectory(dirPath: string[]): Promise<void> {
    try {
      if (dirPath.length === 0) {
        throw new StorageError('Cannot delete root directory');
      }

      const parentPath = dirPath.slice(0, -1);
      const dirName = dirPath[dirPath.length - 1];
      
      const parentHandle = await this.getDirectory(parentPath, false);
      const sanitizedDirName = sanitizeFilename(dirName);
      
      await parentHandle.removeEntry(sanitizedDirName, { recursive: true });
    } catch (error: any) {
      throw new StorageError(`Failed to delete directory: ${error.message}`);
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(dirPath: string[]): Promise<string[]> {
    try {
      const dirHandle = await this.getDirectory(dirPath, false);
      const files: string[] = [];

      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          files.push(entry.name);
        }
      }

      return files;
    } catch (error: any) {
      throw new StorageError(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * List directories
   */
  async listDirectories(dirPath: string[]): Promise<string[]> {
    try {
      const dirHandle = await this.getDirectory(dirPath, false);
      const directories: string[] = [];

      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'directory') {
          directories.push(entry.name);
        }
      }

      return directories;
    } catch (error: any) {
      throw new StorageError(`Failed to list directories: ${error.message}`);
    }
  }

  /**
   * Calculate total size of files in a directory (recursive)
   */
  async calculateDirectorySize(dirPath: string[]): Promise<number> {
    try {
      const dirHandle = await this.getDirectory(dirPath, false);
      let totalSize = 0;

      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const fileHandle = entry as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          totalSize += file.size;
        } else if (entry.kind === 'directory') {
          // Recursive call
          const subSize = await this.calculateDirectorySize([...dirPath, entry.name]);
          totalSize += subSize;
        }
      }

      return totalSize;
    } catch (error: any) {
      console.error('Error calculating directory size:', error);
      return 0;
    }
  }

  /**
   * Open directory in system file explorer (if supported)
   */
  async openInFileExplorer(_dirPath: string[] = []): Promise<void> {
    // Note: There's no direct API to open in file explorer
    // This is a placeholder for potential future functionality
    // or platform-specific implementations
    console.warn('Opening in file explorer not directly supported by File System Access API');
  }
}

// Export singleton instance
export const fileSystem = new FileSystemManager();


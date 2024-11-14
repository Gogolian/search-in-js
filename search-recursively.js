const fs = require('fs');
const path = require('path');

/**
 * Recursively searches for a phrase in all files within a directory
 * @param {string} dirPath - The directory path to start searching from
 * @param {string|Object} searchPattern - The phrase to search for or search configuration
 * @param {string} [searchPattern.include] - Phrase to search for
 * @param {string[]} [searchPattern.exclude] - Phrases to exclude
 * @param {boolean} [searchPattern.wholeWord] - Whether to match whole words only
 * @param {boolean} [searchPattern.caseSensitive] - Whether to perform case-sensitive search
 * @param {Object} options - Configuration options
 * @param {string[]} [options.excludeDirs=['node_modules', '.git']] - Directories to exclude
 * @param {string[]} [options.includeFiles=[]] - File extensions to include (e.g., ['.js', '.vue'])
 * @param {boolean} [options.verbose=false] - Whether to log verbose information
 * @returns {Array<{fileName: string, lines: Array<{content: string, lineNumber: number}>}>}
 */
function searchRecursively(dirPath, searchPattern, options = {}) {
    const {
        excludeDirs = ['node_modules', '.git'],
        includeFiles = [], // Empty array means include all files
        verbose = false
    } = options;

    // Normalize search pattern to object form
    const searchConfig = typeof searchPattern === 'string' 
        ? { include: searchPattern }
        : searchPattern;

    const {
        include,
        exclude = [],
        wholeWord = false,
        caseSensitive = false
    } = searchConfig;

    const results = [];

    function createSearchRegex(pattern, isWholeWord) {
        const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordBoundary = isWholeWord ? '\\b' : '';
        return new RegExp(
            `${wordBoundary}${escapedPattern}${wordBoundary}`,
            caseSensitive ? 'g' : 'gi'
        );
    }

    function matchesSearchCriteria(line) {
        const includeRegex = createSearchRegex(include, wholeWord);
        if (!includeRegex.test(line)) {
            return false;
        }

        // Check if line contains any excluded phrases
        return !exclude.some(excludePhrase => {
            const excludeRegex = createSearchRegex(excludePhrase, wholeWord);
            return excludeRegex.test(line);
        });
    }
    
    function shouldIncludeFile(fileName) {
        if (includeFiles.length === 0) return true;
        const ext = path.extname(fileName).toLowerCase();
        return includeFiles.some(pattern => {
            if (pattern.startsWith('*')) {
                return fileName.toLowerCase().endsWith(pattern.slice(1));
            } else if (pattern.endsWith('*')) {
                return fileName.toLowerCase().startsWith(pattern.slice(0, -1));
            }
            return ext === pattern.toLowerCase();
        });
    }

    function searchInFile(filePath) {
        try {
            if (!shouldIncludeFile(filePath)) {
                return;
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            const matchingLines = [];
            
            lines.forEach((line, index) => {
                if (matchesSearchCriteria(line)) {
                    matchingLines.push({
                        content: line.trim(),
                        lineNumber: index + 1
                    });
                }
            });
            
            if (matchingLines.length > 0) {
                results.push({
                    fileName: filePath,
                    lines: matchingLines
                });
            }
        } catch (error) {
            if (verbose) {
                console.error(`Error reading file ${filePath}: ${error.message}`);
            }
        }
    }
    
    function shouldSkipDirectory(dirName) {
        return excludeDirs.some(excludeDir => {
            if (excludeDir.startsWith('*')) {
                return dirName.endsWith(excludeDir.slice(1));
            } else if (excludeDir.endsWith('*')) {
                return dirName.startsWith(excludeDir.slice(0, -1));
            }
            return dirName === excludeDir;
        });
    }
    
    function traverseDirectory(currentPath) {
        try {
            const items = fs.readdirSync(currentPath);
            
            for (const item of items) {
                try {
                    const fullPath = path.join(currentPath, item);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isDirectory()) {
                        if (!shouldSkipDirectory(item)) {
                            traverseDirectory(fullPath);
                        } else if (verbose) {
                            console.log(`Skipping excluded directory: ${fullPath}`);
                        }
                    } else if (stat.isFile()) {
                        searchInFile(fullPath);
                    }
                } catch (error) {
                    if (verbose) {
                        console.error(`Error processing ${item} in ${currentPath}: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            if (verbose) {
                console.error(`Error reading directory ${currentPath}: ${error.message}`);
            }
        }
    }
    
    traverseDirectory(dirPath);
    return results;
}

module.exports = searchRecursively;

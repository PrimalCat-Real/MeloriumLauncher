import { minimatch } from 'minimatch'

/**
 * Проверяет, соответствует ли путь хотя бы одному из glob-паттернов
 * @param filePath - путь к файлу
 * @param patterns - массив glob-паттернов (например, ['Melorium/shaderpacks/*', 'Melorium/config/'])
 * @returns true если путь соответствует хотя бы одному паттерну
 */
export function matchesIgnoredPath(filePath: string, patterns: string[] | undefined | null): boolean {
    // Проверка на undefined/null
    if (!patterns) {
        return false
    }

    // Проверка что это массив
    if (!Array.isArray(patterns)) {
        console.warn('[matchesIgnoredPath] patterns is not an array:', typeof patterns, patterns)
        return false
    }

    // Проверка на пустой массив
    if (patterns.length === 0) {
        return false
    }

    return patterns.some(pattern => {
        // Пропускаем невалидные паттерны
        if (typeof pattern !== 'string' || !pattern) {
            return false
        }

        // Поддержка как точных путей, так и glob-паттернов
        const isMatch = minimatch(filePath, pattern, {
            matchBase: false,
            dot: true, // Поддержка скрытых файлов
        })
        
        return isMatch
    })
}

/**
 * Фильтрует массив путей, исключая те, которые соответствуют игнорируемым паттернам
 */
export function filterIgnoredPaths(paths: string[], ignoredPatterns: string[] | undefined | null): string[] {
    if (!ignoredPatterns || !Array.isArray(ignoredPatterns) || ignoredPatterns.length === 0) {
        return paths
    }

    return paths.filter(path => !matchesIgnoredPath(path, ignoredPatterns))
}

# Foosball Manager - Advanced Data Persistence

This folder contains the Foosball Manager application with enhanced automatic data persistence that works like file storage but without manual intervention.

## 🚀 New Features - Automatic File-like Storage

The application now uses **IndexedDB** as primary storage, providing automatic, file-like persistence without requiring manual saves!

### ✨ Key Improvements
- **No manual saving required** - Data automatically persists like files
- **Much larger storage capacity** - Several GB vs localStorage's ~10MB
- **Database-like reliability** - Structured data with transactions
- **Automatic fallback system** - Multiple layers of data protection

## Files

### `index.tsx`
Enhanced Foosball Manager with advanced data persistence:
- **IndexedDB**: Primary automatic storage (file-like behavior)
- **localStorage**: Real-time backup fallback
- **File export**: Downloadable files for artifacts folder
- **Auto-migration**: Seamless upgrade from old localStorage data

### `data-config.json`
Configuration file defining the complete data persistence architecture

## Data Persistence Features

### 1. Primary Storage - IndexedDB
- **Automatic saving**: Data saved automatically to IndexedDB on every change
- **High capacity**: Much larger storage than localStorage (several GB)
- **Structured data**: Proper database-like storage with transactions
- **Browser persistence**: Data survives browser restarts and crashes
- **No manual intervention**: Works like file storage but automatically

### 2. Fallback Storage - localStorage  
- **Backup system**: Automatic fallback if IndexedDB fails
- **Real-time sync**: Every change also saved to localStorage
- **Cross-session**: Data persists across browser sessions
- **Migration**: Automatically migrates old localStorage data to IndexedDB

### 3. File Export/Import System
- **Auto-export**: Automatically exports to downloadable file every 10 matches
- **Manual export**: Click "Esporta su File" to create artifacts folder file
- **Import**: Load data from JSON files via "Importa da File"
- **Backup compatibility**: Full compatibility with manual backup system

### 4. Traditional Backup System
- **Export**: Download complete backup file with metadata
- **Import**: Load backup from any compatible JSON file
- **Reset**: Clear all data with confirmation dialog

## Data Structure

### Player Object
```typescript
interface Player {
  id: number;
  name: string;
  elo: number;
  matches: number;
  wins: number;
  losses: number;
}
```

### Match Object
```typescript
interface Match {
  id: number;
  date: string;
  time: string;
  team1: string[];
  team2: string[];
  winner: string;
  eloChanges: { [playerName: string]: number };
}
```

## Storage Architecture

```
User Action (Add Match)
         ↓
    Automatic Save to:
    ┌─────────────────┐
    │   IndexedDB     │ ← Primary (file-like behavior)
    │  (Automatic)    │
    └─────────────────┘
         ↓
    ┌─────────────────┐
    │  localStorage   │ ← Fallback backup
    │   (Real-time)   │
    └─────────────────┘
         ↓
    Every 10 matches:
    ┌─────────────────┐
    │  File Export    │ ← Artifacts folder
    │  (Auto-export)  │
    └─────────────────┘
```

## Usage

1. **Just use the app normally** - Everything saves automatically!
2. **View rankings**: Check "Classifica" tab for ELO rankings
3. **Add matches**: Use "Nuova Partita" tab
4. **Review history**: Use "Storico" tab for match history
5. **Optional file operations**: Use "Backup" tab if needed

## Technical Benefits

### Why IndexedDB over localStorage?
- **Storage limit**: GB vs ~10MB
- **Data structure**: Native object storage vs string serialization  
- **Performance**: Async operations vs blocking
- **Reliability**: Transaction-based vs single-operation
- **Browser support**: Universal modern browser support

### Automatic Behavior
- ✅ **Auto-save on every match** (like auto-save in documents)
- ✅ **Persistent across browser sessions** (like saved files)
- ✅ **Survives browser crashes** (like recovered documents)
- ✅ **No user intervention required** (like cloud sync)
- ✅ **Multiple backup layers** (like version control)

## File Naming Convention

- Auto-exported files: `foosball-data-YYYY-MM-DD.json`
- Manual backups: `foosball-backup-YYYY-MM-DD.json`
- Database name: `FoosballManagerDB`
- Store name: `gameData`

## Migration Notes

Existing users with localStorage data will be automatically migrated to IndexedDB on first load. No data loss occurs during this process. 
# Code Audit Report
**Date:** 2025-12-11  
**Auditor:** Auto (AI Code Assistant)

## Executive Summary

This audit reviewed the RoverExploration Discord bot codebase for security, reliability, type safety, and best practices. Several critical issues were identified that could lead to race conditions, data inconsistencies, and potential bugs.

---

## 🔴 CRITICAL ISSUES

### 1. Race Condition in Exploration Creation (HIGH PRIORITY)

**Location:** `src/services/explorationService.ts:startExploration()`

**Issue:** 
The function checks for active exploration, then creates a new one. If two requests come in simultaneously, both can pass the check and both will create explorations.

**Current Code:**
```typescript
const active = await getActiveExploration(userId);
if (active) {
  throw new Error(`User ${userId} already has an active exploration`);
}
await createExploration(userId, biome, durationHours);
```

**Risk:** Users could have multiple active explorations, breaking cooldown logic.

**Recommendation:** Add database-level unique constraint or use transaction with row-level locking.

---

### 2. Race Condition in Party Exploration Creation (HIGH PRIORITY)

**Location:** `src/commands/party.ts:startPartyExpedition()`

**Issue:**
When creating party explorations, the code doesn't check if party members already have active explorations. This could create duplicate explorations for users who joined a party while already exploring.

**Current Code:**
```typescript
for (const member of party.joinedUsers) {
  const exploration = await createExploration(member.userId, party.biome, party.durationHours);
  explorationIds.push(exploration.id);
}
```

**Risk:** Party members could end up with multiple active explorations.

**Recommendation:** Check each member's active exploration status before creating party exploration, or handle the error gracefully.

---

### 3. Data Type Mismatch: duration_hours (MEDIUM PRIORITY)

**Location:** `src/db/models.ts:createExploration()`

**Issue:**
The database column `duration_hours` is defined as `INTEGER` but the code stores floating point values (e.g., `0.008333` for 30 seconds).

**Current Schema:**
```sql
duration_hours INTEGER NOT NULL
```

**Actual Usage:**
```typescript
durationHours = 0.008333; // 30 seconds
```

**Risk:** Data loss/truncation - 30-second explorations will be stored as 0 hours.

**Recommendation:** Change column type to `DECIMAL` or `FLOAT`, or store as milliseconds/seconds as INTEGER.

---

## 🟡 MEDIUM PRIORITY ISSUES

### 4. Memory Leaks with setTimeout in Party System

**Location:** `src/commands/party.ts:startPartyExpedition()`

**Issue:**
Party completion uses `setTimeout` which persists in memory. If the bot restarts, these timers are lost and party expeditions won't complete properly.

**Current Code:**
```typescript
setTimeout(async () => {
  await completePartyExpedition(client, partyId);
}, timeUntilCompletion);
```

**Risk:** Party expeditions may never complete if bot restarts during the timer period.

**Recommendation:** Use cron job to check party completion times, similar to regular explorations.

---

### 5. Party Messages Not Using Message Variations

**Location:** `src/commands/party.ts:completePartyExpedition()`

**Issue:**
Party completion messages are hardcoded and don't use the message variations system that regular explorations use.

**Current Code:**
```typescript
message = `${emoji} ${userMentions} return from the **${party.biomeName}** and discovered the **${itemFound.name}** (${itemFound.rarity})!`;
```

**Recommendation:** Use `getReturnWithItemMessage()` and `getReturnEmptyMessage()` for consistency.

---

### 6. Missing Error Recovery in Exploration Start

**Location:** `src/commands/explore.ts:handleExploreCommand()`

**Issue:**
If `channel.send()` fails after exploration is created, the exploration exists but no public message is sent. The user only sees the ephemeral confirmation.

**Current Code:**
```typescript
await startExploration(userId, biomeId, durationHours);
// ... later ...
await (channel as TextChannel).send(message);
```

**Risk:** Explorations could be created silently without public notification.

**Recommendation:** Add error handling around channel.send() or log it for monitoring.

---

### 7. Type Safety: Excessive Use of `as any`

**Location:** Multiple files, especially `src/commands/party.ts`

**Issue:**
Party interface extended with dynamic properties using `(party as any).lootResult`, `(party as any).explorationIds`, etc.

**Files Affected:**
- `src/commands/party.ts` (multiple instances)
- `src/services/partyLootService.ts` (line 49)

**Recommendation:** Properly extend the Party interface in `src/types/party.ts` to include these optional properties.

---

### 8. Database Transaction Safety

**Location:** `src/db/models.ts:completeExploration()`

**Issue:**
`completeExploration()` calls `updateUserProfile()` but they're not in a transaction. If profile update fails, the exploration is marked complete but items aren't saved.

**Current Code:**
```typescript
await db.query(`UPDATE explorations SET completed = TRUE, item_found = $1 WHERE id = $2`, ...);
// ... then separately ...
await updateUserProfile(user_id, ends_at, itemFound);
```

**Risk:** Data inconsistency - exploration could be marked complete but items not saved to profile.

**Recommendation:** Wrap in database transaction or add retry logic.

---

### 9. Dead Code: processCompletedExploration()

**Location:** `src/services/explorationService.ts:processCompletedExploration()`

**Issue:**
Function throws error saying it "should be called with exploration data" but is never actually used. Appears to be leftover from refactoring.

**Recommendation:** Remove if unused, or implement if needed.

---

## 🟢 LOW PRIORITY / CODE QUALITY

### 10. Duration Parsing Could Be More Robust

**Location:** `src/commands/explore.ts:handleExploreCommand()`

**Current Code:**
```typescript
if (durationText === '30s') {
  durationHours = 0.008333;
} else if (durationText === '1h') {
  durationHours = 1;
}
```

**Recommendation:** Consider a lookup map for cleaner code and easier maintenance.

---

### 11. Inconsistent Error Handling

**Issue:**
Some functions log errors and continue, others throw. No standardized error handling strategy.

**Recommendation:** Establish consistent error handling patterns across the codebase.

---

### 12. Missing Input Validation

**Location:** Various command handlers

**Issue:**
Some user inputs (like biome IDs) are validated, but others assume valid Discord IDs, channel IDs, etc.

**Recommendation:** Add validation for all user-provided inputs.

---

## ✅ POSITIVE FINDINGS

1. **Good separation of concerns** - Commands, services, and database layers are well separated
2. **Message variation system** - Nice implementation of lore-friendly message randomization
3. **Type definitions** - Good use of TypeScript interfaces
4. **Error logging** - Comprehensive logging throughout
5. **Cooldown system** - Prevents basic abuse

---

## RECOMMENDATIONS PRIORITY

1. **URGENT:** Fix race conditions in exploration creation (#1, #2)
2. **URGENT:** Fix duration_hours data type mismatch (#3)
3. **HIGH:** Fix party setTimeout memory leak (#4)
4. **MEDIUM:** Use message variations for party messages (#5)
5. **MEDIUM:** Improve error recovery (#6)
6. **MEDIUM:** Fix type safety issues (#7)
7. **MEDIUM:** Add database transactions (#8)
8. **LOW:** Clean up dead code (#9)
9. **LOW:** Code quality improvements (#10-12)

---

## CONCLUSION

The codebase is generally well-structured but has several critical race conditions and type safety issues that should be addressed before production use. The most urgent fixes are around concurrent exploration creation and the duration_hours data type.


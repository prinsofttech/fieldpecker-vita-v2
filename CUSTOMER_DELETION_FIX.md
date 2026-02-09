# Customer Deletion Foreign Key Constraint Fix

## Issue
When attempting to delete a customer who has associated issues, you receive this error:
```
Error deleting customer: update or delete on table "customers" violates foreign key constraint "issues_customer_id_fkey" on table "issues"
```

## Why This Happens
The `issues` table has a foreign key relationship with the `customers` table. When the foreign key constraint was created, it defaulted to `RESTRICT` behavior, which prevents deletion of customers that have any linked issues.

## Solution

### Option 1: Fix the Database Constraint (Recommended)
Run the SQL script `FIX_CUSTOMER_DELETION_CONSTRAINT.sql` in your Supabase SQL Editor:

1. Open your Supabase Dashboard
2. Go to the SQL Editor
3. Copy and paste the contents of `FIX_CUSTOMER_DELETION_CONSTRAINT.sql`
4. Run the script

This will:
- Update the foreign key constraint to use `ON DELETE SET NULL`
- Allow customer deletion while preserving issue records
- Set the `customer_id` to NULL in issues when their customer is deleted

### Option 2: Resolve Issues Before Deletion
Before deleting a customer:
1. Go to the Issue Tracker module
2. Find all issues assigned to or related to that customer
3. Either:
   - Resolve and close the issues, OR
   - Reassign them to a different customer

### Option 3: Deactivate Instead of Delete
Instead of deleting customers with historical data:
1. Edit the customer
2. Set their status to "Inactive"
3. This preserves all historical records while removing them from active use

## What Changed in the Application
The application now provides clearer error messages when deletion fails due to foreign key constraints, explaining:
- Why the deletion failed
- What related records exist
- What actions you can take to resolve it

## Prevention
Going forward, consider deactivating customers rather than deleting them if they have any activity in the system. This preserves data integrity and historical records.

# Repository Cleanup Guidance

This document contains advisory guidance for keeping the repository manageable.

## Large files

Model weights, videos, and other large binaries should generally not be committed directly to a normal Git repository when they are not required for source review.

Possible approaches:

- Git LFS for large files that must remain versioned.
- External model/download instructions for model weights.
- Sample or compressed media kept separately from the source repository.

## Important

Do not delete or rewrite repository history without first confirming that the files are no longer needed and that all collaborators agree.

Migrating existing large files to Git LFS can rewrite Git history and should be treated as a deliberate repository migration.

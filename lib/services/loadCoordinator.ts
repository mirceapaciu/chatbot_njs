type ReleaseFn = () => void;

// Simple in-memory load coordinator to prevent concurrent DB loads within the same server instance.
class LoadCoordinator {
  private inProgress = false;

  tryAcquire(): ReleaseFn | null {
    if (this.inProgress) {
      return null;
    }
    this.inProgress = true;
    return () => {
      this.inProgress = false;
    };
  }
}

export const loadCoordinator = new LoadCoordinator();

type ReleaseFn = () => void;

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

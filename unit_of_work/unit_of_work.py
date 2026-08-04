
#What is it used for? To control the commit and rollback of a set of operations
#Why is it implemented? To ensure that multiple database changes are either committed or rolled back together
#What problem does it solve? It prevents one operation from being saved when another related operation fails

class UnitOfWork:
    def __init__(self, session):
        self.session = session

    def commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()


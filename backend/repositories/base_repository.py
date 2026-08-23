from sqlalchemy import select

#Generic methods for get/list/create/update/delete), so other repos may use them
class BaseRepository:

    def __init__(self, session, model):
        self.session = session
        self.model = model

    def get_by_id(self, id):

        return self.session.get(self.model, id)

    def list_all(self):
        stmt = select(self.model) #SELECT * FROM Model(Eg: users)

        return self.session.scalars(stmt).all()

    def create(self, instance):

        self.session.add(instance) 

        #No commit yet since we are gonna call this method from the respective service and then commit and refresh(if required)

        return instance

    def update(self, instance):

        self.session.add(instance)

        return instance

    def delete(self, instance):
    
        self.session.delete(instance)

